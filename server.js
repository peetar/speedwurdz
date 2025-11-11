const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dictionary = require('./dictionary');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store active users and tables
const activeUsers = new Map(); // userId -> {username, socketId}
const gameTables = new Map();  // tableId -> {id, name, host, players, maxPlayers, status}

// Game tile system - 3 of each letter A-Z (78 total tiles)
const TILE_LETTERS = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

// Scrabble tile point values
const TILE_VALUES = {
    'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1,
    'J': 8, 'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1,
    'S': 1, 'T': 1, 'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10
};

function generateRandomTilePool(poolSize) {
    const tray = [];
    let tileId = 1;
    
    // Vowel weights: E(29%), A(22%), O(19%), I(19%), U(10%)
    const vowels = ['E', 'A', 'O', 'I', 'U'];
    const vowelWeights = [29, 22, 19, 19, 10];
    
    // Consonant frequency groups with weights
    const highFreqConsonants = ['S', 'N', 'R', 'T']; // 9% each
    const mediumFreqConsonants = ['G', 'L', 'D']; // 6% each  
    const lowMediumFreqConsonants = ['Y', 'P', 'F', 'H', 'B', 'C', 'M', 'V', 'W']; // 4% each
    const lowFreqConsonants = ['Q', 'X', 'K', 'J', 'Z']; // 2% each
    
    // Calculate vowel count (40-45% of pool)
    const vowelPercentage = 40 + Math.random() * 5; // Random between 40-45%
    const vowelCount = Math.floor(poolSize * vowelPercentage / 100);
    const consonantCount = poolSize - vowelCount;
    
    console.log(`Generating tile pool: ${poolSize} tiles (${vowelCount} vowels, ${consonantCount} consonants)`);
    
    // Track letter counts for special rules
    const letterCounts = {};
    
    // Generate vowels with weighted selection
    for (let i = 0; i < vowelCount; i++) {
        const vowel = weightedRandomSelect(vowels, vowelWeights);
        letterCounts[vowel] = (letterCounts[vowel] || 0) + 1;
        tray.push({
            id: tileId++,
            letter: vowel,
            state: 'pool', // Track tile state: pool, hand, board
            playerId: null, // Which player owns this tile (if in hand/board)
            position: null  // Board position if placed
        });
    }
    
    // Add one of each consonant first
    const allConsonants = [...highFreqConsonants, ...mediumFreqConsonants, ...lowMediumFreqConsonants, ...lowFreqConsonants];
    allConsonants.forEach(consonant => {
        letterCounts[consonant] = (letterCounts[consonant] || 0) + 1;
        tray.push({
            id: tileId++,
            letter: consonant,
            state: 'pool',
            playerId: null,
            position: null
        });
    });
    
    // Fill remaining consonant slots with weighted random selection
    const remainingConsonants = consonantCount - allConsonants.length;
    for (let i = 0; i < remainingConsonants; i++) {
        let consonant;
        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loop
        
        do {
            const rand = Math.random() * 100;
            
            if (rand < 2 * lowFreqConsonants.length) {
                // 2% each for Q, X, K, J, Z (10% total)
                consonant = lowFreqConsonants[Math.floor(Math.random() * lowFreqConsonants.length)];
            } else if (rand < 2 * lowFreqConsonants.length + 4 * lowMediumFreqConsonants.length) {
                // 4% each for Y, P, F, H, B, C, M, V, W (36% total)
                consonant = lowMediumFreqConsonants[Math.floor(Math.random() * lowMediumFreqConsonants.length)];
            } else if (rand < 2 * lowFreqConsonants.length + 4 * lowMediumFreqConsonants.length + 6 * mediumFreqConsonants.length) {
                // 6% each for G, L, D (18% total)
                consonant = mediumFreqConsonants[Math.floor(Math.random() * mediumFreqConsonants.length)];
            } else {
                // 9% each for S, N, R, T (36% total)
                consonant = highFreqConsonants[Math.floor(Math.random() * highFreqConsonants.length)];
            }
            
            attempts++;
        } while (attempts < maxAttempts && 
                 ((consonant === 'Q' || consonant === 'Z') && (letterCounts[consonant] || 0) >= 2));
        
        // If we hit max attempts, pick a safe consonant
        if (attempts >= maxAttempts) {
            consonant = highFreqConsonants[Math.floor(Math.random() * highFreqConsonants.length)];
        }
        
        letterCounts[consonant] = (letterCounts[consonant] || 0) + 1;
        tray.push({
            id: tileId++,
            letter: consonant,
            state: 'pool',
            playerId: null,
            position: null
        });
    }
    
    // Ensure at least 2 U tiles
    const currentUCount = letterCounts['U'] || 0;
    if (currentUCount < 2) {
        const uNeeded = 2 - currentUCount;
        console.log(`Adding ${uNeeded} additional U tiles to meet minimum requirement`);
        
        for (let i = 0; i < uNeeded; i++) {
            tray.push({
                id: tileId++,
                letter: 'U',
                state: 'pool',
                playerId: null,
                position: null
            });
        }
    }
    
    // Log tile breakdown
    logTilePoolBreakdown(tray);
    
    return tray;
}

function weightedRandomSelect(items, weights) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return items[i];
        }
    }
    
    return items[items.length - 1]; // fallback
}

function logTilePoolBreakdown(tray) {
    const letterCounts = {};
    tray.forEach(tile => {
        letterCounts[tile.letter] = (letterCounts[tile.letter] || 0) + 1;
    });
    
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    const vowelCount = vowels.reduce((sum, vowel) => sum + (letterCounts[vowel] || 0), 0);
    const consonantCount = tray.length - vowelCount;
    
    console.log('=== TILE POOL BREAKDOWN ===');
    console.log(`Total tiles: ${tray.length}`);
    console.log(`Vowels: ${vowelCount} (${(vowelCount/tray.length*100).toFixed(1)}%)`);
    console.log(`Consonants: ${consonantCount} (${(consonantCount/tray.length*100).toFixed(1)}%)`);
    
    // Check special rules
    const qCount = letterCounts['Q'] || 0;
    const zCount = letterCounts['Z'] || 0;
    const uCount = letterCounts['U'] || 0;
    console.log(`\nSpecial Rules Applied:`);
    console.log(`Q tiles: ${qCount} (max 2) ✓`);
    console.log(`Z tiles: ${zCount} (max 2) ✓`);
    console.log(`U tiles: ${uCount} (min 2) ${uCount >= 2 ? '✓' : '✗'}`);
    
    console.log('\nLetter counts:');
    
    // Sort by count descending
    const sortedLetters = Object.entries(letterCounts).sort((a, b) => b[1] - a[1]);
    sortedLetters.forEach(([letter, count]) => {
        const percentage = (count / tray.length * 100).toFixed(1);
        let marker = '';
        if (letter === 'Q' || letter === 'Z') marker = ' (max 2)';
        if (letter === 'U') marker = ' (min 2)';
        console.log(`${letter}: ${count} (${percentage}%)${marker}`);
    });
    console.log('========================');
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function dealTilesToPlayers(gameState, tilesPerPlayer = 10, poolSize = 100) {
    // Create a fresh tile tray for this game with custom pool size
    const allTiles = generateRandomTilePool(poolSize);
    const shuffledTiles = shuffleArray([...allTiles]);
    
    // Store all tiles in the game state for tracking
    gameState.allTiles = new Map();
    allTiles.forEach(tile => {
        gameState.allTiles.set(tile.id, tile);
    });
    
    // Deal tiles to each player
    gameState.players.forEach(player => {
        player.hand = [];
        // Initialize board structure if not already present
        if (!player.board || typeof player.board !== 'object') {
            player.board = initializeBoard();
        }
        
        for (let i = 0; i < tilesPerPlayer && shuffledTiles.length > 0; i++) {
            const tile = shuffledTiles.pop();
            if (tile) {
                // Update tile state
                tile.state = 'hand';
                tile.playerId = player.username;
                
                player.hand.push({
                    id: tile.id,
                    letter: tile.letter
                });
            }
        }
    });
    
    // Store remaining tiles as available pool
    gameState.tileTray = shuffledTiles.filter(tile => tile.state === 'pool');
    
    console.log(`Dealt ${tilesPerPlayer} tiles to ${gameState.players.length} players. ${gameState.tileTray.length} tiles remaining in pool.`);
    
    return gameState;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle user joining the lobby
    socket.on('join-lobby', (username) => {
        if (!username || username.trim() === '') {
            socket.emit('error', 'Username is required');
            return;
        }

        // Check if username is already taken
        const existingUser = Array.from(activeUsers.values()).find(user => user.username === username);
        if (existingUser) {
            socket.emit('error', 'Username already taken');
            return;
        }

        // Add user to active users
        activeUsers.set(socket.id, {
            username: username,
            socketId: socket.id
        });

        // Join the lobby room
        socket.join('lobby');

        // Send current state to the new user
        socket.emit('lobby-joined', {
            username: username,
            users: Array.from(activeUsers.values()).map(user => user.username),
            tables: Array.from(gameTables.values())
        });

        // Notify other users in lobby
        socket.to('lobby').emit('user-joined', {
            username: username,
            users: Array.from(activeUsers.values()).map(user => user.username)
        });

        console.log(`${username} joined the lobby`);
    });

    // Handle creating a new table
    socket.on('create-table', (tableData) => {
        const user = activeUsers.get(socket.id);
        if (!user) {
            socket.emit('error', 'You must join the lobby first');
            return;
        }

        const tableId = generateTableId();
        const newTable = {
            id: tableId,
            name: tableData.name || `${user.username}'s Game`,
            host: user.username,
            players: [user.username],
            maxPlayers: tableData.maxPlayers || 4,
            startingTiles: tableData.startingTiles || Math.max(75, (tableData.maxPlayers || 4) * 25),
            status: 'waiting',
            created: new Date()
        };

        gameTables.set(tableId, newTable);

        // Join the table room
        socket.join(`table-${tableId}`);

        // Notify lobby of new table
        io.to('lobby').emit('table-created', {
            table: newTable,
            tables: Array.from(gameTables.values())
        });

        // Send confirmation to creator
        socket.emit('table-joined', newTable);

        console.log(`${user.username} created table: ${newTable.name}`);
    });

    // Handle joining a table
    socket.on('join-table', (tableId) => {
        const user = activeUsers.get(socket.id);
        const table = gameTables.get(tableId);

        if (!user) {
            socket.emit('error', 'You must join the lobby first');
            return;
        }

        if (!table) {
            socket.emit('error', 'Table not found');
            return;
        }

        if (table.players.length >= table.maxPlayers) {
            socket.emit('error', 'Table is full');
            return;
        }

        if (table.players.includes(user.username)) {
            socket.emit('error', 'You are already in this table');
            return;
        }

        if (table.status !== 'waiting') {
            socket.emit('error', 'Game has already started');
            return;
        }

        // Add player to table
        table.players.push(user.username);

        // Join the table room
        socket.join(`table-${tableId}`);

        // Notify table players
        io.to(`table-${tableId}`).emit('player-joined', {
            username: user.username,
            table: table
        });

        // Update lobby with table changes
        io.to('lobby').emit('table-updated', {
            table: table,
            tables: Array.from(gameTables.values())
        });

        // Send confirmation to joiner
        socket.emit('table-joined', table);

        console.log(`${user.username} joined table: ${table.name}`);
    });

    // Handle leaving a table
    socket.on('leave-table', (tableId) => {
        const user = activeUsers.get(socket.id);
        const table = gameTables.get(tableId);

        if (!user || !table) return;

        // Remove player from table
        table.players = table.players.filter(player => player !== user.username);

        // Leave the table room
        socket.leave(`table-${tableId}`);

        if (table.players.length === 0) {
            // Delete empty table
            gameTables.delete(tableId);
            io.to('lobby').emit('table-deleted', {
                tableId: tableId,
                tables: Array.from(gameTables.values())
            });
        } else {
            // If host left, assign new host
            if (table.host === user.username && table.players.length > 0) {
                table.host = table.players[0];
            }

            // Notify remaining players
            io.to(`table-${tableId}`).emit('player-left', {
                username: user.username,
                table: table
            });

            // Update lobby
            io.to('lobby').emit('table-updated', {
                table: table,
                tables: Array.from(gameTables.values())
            });
        }

        console.log(`${user.username} left table: ${table.name}`);
    });

    // Handle starting a game
    socket.on('start-game', (tableId) => {
        const user = activeUsers.get(socket.id);
        const table = gameTables.get(tableId);

        if (!user || !table) {
            socket.emit('error', 'Table not found');
            return;
        }

        if (table.host !== user.username) {
            socket.emit('error', 'Only the host can start the game');
            return;
        }

        if (table.status !== 'waiting') {
            socket.emit('error', 'Game has already started');
            return;
        }

        // Allow solo play or require at least 1 player (solo mode)
        if (table.players.length < 1) {
            socket.emit('error', 'Need at least 1 player to start');
            return;
        }

        // Update table status to in-game
        table.status = 'playing';

        // Initialize game state
        const gameState = {
            tableId: tableId,
            players: table.players.map(playerName => ({
                username: playerName,
                board: initializeBoard(),
                hand: [], // Will be populated when gameplay starts
                score: 0,
                ready: false,
                // Game statistics
                tilesTrashCount: 0,
                validSubmissions: 0,
                lastValidBoard: [] // Store last valid board submission for scoring
            })),
            status: 'waiting-to-start', // Players are in game but waiting for host to start
            countdownTimer: null,
            startTime: null,
            tileTray: []
        };

        // Store game state (in a real app, you'd use a database)
        table.gameState = gameState;

        // Notify all players in the table to enter game screen
        io.to(`table-${tableId}`).emit('enter-game', {
            table: table,
            gameState: gameState
        });

        // Update lobby that this table is now playing
        io.to('lobby').emit('table-updated', {
            table: table,
            tables: Array.from(gameTables.values())
        });

        console.log(`Players entered game for table: ${table.name}`);
    });

    // Handle host starting the actual gameplay with countdown
    socket.on('start-gameplay', (tableId) => {
        const user = activeUsers.get(socket.id);
        const table = gameTables.get(tableId);

        if (!user || !table || !table.gameState) {
            socket.emit('error', 'Game not found');
            return;
        }

        if (table.host !== user.username) {
            socket.emit('error', 'Only the host can start the gameplay');
            return;
        }

        if (table.gameState.status !== 'waiting-to-start') {
            socket.emit('error', 'Game cannot be started right now');
            return;
        }

        // Start the countdown
        table.gameState.status = 'countdown';
        table.gameState.countdownTimer = 3;

        // Notify all players that countdown has started
        io.to(`table-${tableId}`).emit('countdown-started', {
            gameState: table.gameState
        });

        // Start countdown
        startGameCountdown(tableId);

        console.log(`Countdown started for table: ${table.name}`);
    });

    // Handle game actions during gameplay
    socket.on('game-action', (data) => {
        const user = activeUsers.get(socket.id);
        const table = gameTables.get(data.tableId);

        if (!user || !table || !table.gameState) {
            socket.emit('error', 'Game not found');
            return;
        }

        handleGameAction(socket, user, table, data);
    });

    // Handle requests for current game state (debug/sync purposes)
    socket.on('request-game-state', (data) => {
        const user = activeUsers.get(socket.id);
        const table = gameTables.get(data.tableId);

        if (!user || !table || !table.gameState) {
            socket.emit('error', 'Game not found');
            return;
        }

        console.log(`${user.username} requested game state refresh`);
        socket.emit('game-state-updated', {
            gameState: table.gameState
        });
    });

    // Handle player resigning from game
    socket.on('resign-game', (tableId) => {
        const user = activeUsers.get(socket.id);
        const table = gameTables.get(tableId);

        if (!user || !table || !table.gameState) return;

        console.log(`${user.username} resigned from game: ${table.name} - ending game for all players`);

        // End the game immediately when any player resigns
        endGameAndReturnToLobby(tableId, `${user.username} resigned - game ended`);
    });

    // Debug refresh handlers
    socket.on('requestHandUpdate', () => {
        console.log(`=== HAND REFRESH REQUEST from ${socket.id} ===`);
        const user = activeUsers.get(socket.id);
        if (user && user.tableId) {
            const table = activeTables.get(user.tableId);
            if (table && table.gameState && table.gameState.players) {
                const player = table.gameState.players.find(p => p.username === user.username);
                if (player && player.hand) {
                    console.log(`Sending hand update to ${user.username}: ${player.hand.length} tiles`);
                    socket.emit('handUpdate', player.hand);
                } else {
                    console.log(`Player ${user.username} not found or has no hand`);
                }
            } else {
                console.log(`No valid game state found for table ${user.tableId}`);
            }
        } else {
            console.log(`User ${socket.id} not found or not in a table`);
        }
    });

    socket.on('requestBoardUpdate', () => {
        console.log(`=== BOARD REFRESH REQUEST from ${socket.id} ===`);
        const user = activeUsers.get(socket.id);
        if (user && user.tableId) {
            const table = activeTables.get(user.tableId);
            if (table && table.gameState && table.gameState.allTiles) {
                // Send only this player's tiles from the board
                const playerTiles = Array.from(table.gameState.allTiles.values())
                    .filter(tile => tile.state === 'board' && tile.boardOwner === user.username);
                console.log(`Sending board update to ${user.username}: ${playerTiles.length} tiles on board`);
                
                // Convert to client format
                const boardData = {};
                playerTiles.forEach(tile => {
                    const key = `${tile.position.x},${tile.position.y}`;
                    boardData[key] = {
                        id: tile.id,
                        letter: tile.letter,
                        boardOwner: tile.boardOwner,
                        x: tile.position.x,
                        y: tile.position.y
                    };
                });
                socket.emit('boardUpdate', boardData);
            } else {
                console.log(`No valid game state found for table ${user.tableId}`);
            }
        } else {
            console.log(`User ${socket.id} not found or not in a table`);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            console.log(`${user.username} disconnected`);

            // Remove from active users
            activeUsers.delete(socket.id);

            // Remove from all tables
            for (const [tableId, table] of gameTables.entries()) {
                if (table.players.includes(user.username)) {
                    table.players = table.players.filter(player => player !== user.username);

                    if (table.players.length === 0) {
                        gameTables.delete(tableId);
                        io.to('lobby').emit('table-deleted', {
                            tableId: tableId,
                            tables: Array.from(gameTables.values())
                        });
                    } else {
                        if (table.host === user.username) {
                            table.host = table.players[0];
                        }
                        io.to(`table-${tableId}`).emit('player-left', {
                            username: user.username,
                            table: table
                        });
                        io.to('lobby').emit('table-updated', {
                            table: table,
                            tables: Array.from(gameTables.values())
                        });
                    }
                }
            }

            // Notify lobby of user leaving
            socket.to('lobby').emit('user-left', {
                username: user.username,
                users: Array.from(activeUsers.values()).map(user => user.username)
            });
        }
    });
});

// Utility function to generate table IDs
function generateTableId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Initialize a game board (100x100 grid, but we'll track positions relative to center)
function initializeBoard() {
    return {
        tiles: new Map(), // Will store tile positions as "x,y" -> tileData
        startPosition: { x: 0, y: 0 }, // Center of the board
        viewPosition: { x: 0, y: 0 } // Current view offset
    };
}

// Start game countdown
function startGameCountdown(tableId) {
    const table = gameTables.get(tableId);
    if (!table || !table.gameState) return;

    const countdown = setInterval(() => {
        // Check if table still exists and is in countdown state
        const currentTable = gameTables.get(tableId);
        if (!currentTable || !currentTable.gameState || currentTable.gameState.status !== 'countdown') {
            clearInterval(countdown);
            return;
        }

        currentTable.gameState.countdownTimer--;
        
        // Notify players of countdown update
        io.to(`table-${tableId}`).emit('countdown-update', {
            timer: currentTable.gameState.countdownTimer
        });

        if (currentTable.gameState.countdownTimer <= 0) {
            clearInterval(countdown);
            
            // Start the actual game
            currentTable.gameState.status = 'playing';
            currentTable.gameState.startTime = new Date();
            currentTable.gameState.countdownTimer = null;
            
            // Deal tiles to all players
            dealTilesToPlayers(currentTable.gameState, 10, currentTable.startingTiles);

            // Notify players that game has started
            const serializedGameState = {
                ...currentTable.gameState,
                allTiles: currentTable.gameState.allTiles ? Object.fromEntries(currentTable.gameState.allTiles) : {}
            };
            
            io.to(`table-${tableId}`).emit('game-started', {
                gameState: serializedGameState
            });

            // Update lobby
            io.to('lobby').emit('table-updated', {
                table: currentTable,
                tables: Array.from(gameTables.values())
            });

            console.log(`Game started for table: ${currentTable.name} - dealt 10 tiles to each player`);
        }
    }, 1000);
}

// Handle game actions
function handleGameAction(socket, user, table, data) {
    const gameState = table.gameState;
    const player = gameState.players.find(p => p.username === user.username);
    
    if (!player || player.resigned) {
        socket.emit('error', 'You are not in this game');
        return;
    }

    switch (data.action) {
        case 'move-board':
            // Handle board scrolling
            if (data.direction) {
                const amount = data.amount || 1; // Default to 1 if not specified
                player.board.viewPosition = updateViewPosition(player.board.viewPosition, data.direction, amount);
                socket.emit('board-updated', {
                    board: player.board
                });
            }
            break;
        
        case 'place-tile':
            // Handle tile placement on board
            handleTilePlacement(socket, user, table, data);
            break;
            
        case 'return-tile-to-hand':
            // Handle returning tile from board to hand
            handleTileReturnToHand(socket, user, table, data);
            break;
            
        case 'move-tile-on-board':
            // Handle moving tile from one board position to another
            handleTileMoveOnBoard(socket, user, table, data);
            break;
            
        case 'submit-board':
            // Handle board submission
            handleBoardSubmission(socket, user, table, data);
            break;
            
        case 'trash-tile':
            // Handle tile trashing - return 1 tile to pool, give 3 new tiles
            handleTileTrash(socket, user, table, data);
            break;
            
        default:
            socket.emit('error', 'Unknown game action');
    }
}

// Update view position for board scrolling
function updateViewPosition(currentPos, direction, multiplier = 1) {
    const newPos = { ...currentPos };
    const baseScrollAmount = 2; // Reduced base scroll amount per tile (was 5)
    const scrollAmount = baseScrollAmount * multiplier; // Apply multiplier

    switch (direction) {
        case 'up':
            newPos.y = Math.max(newPos.y - scrollAmount, -40); // Limit scrolling
            break;
        case 'down':
            newPos.y = Math.min(newPos.y + scrollAmount, 40);
            break;
        case 'left':
            newPos.x = Math.max(newPos.x - scrollAmount, -40);
            break;
        case 'right':
            newPos.x = Math.min(newPos.x + scrollAmount, 40);
            break;
    }

    return newPos;
}

// Check if all tiles in boardData are connected to each other
function checkTilesConnected(boardData) {
    if (boardData.length <= 1) {
        return true; // Single tile or no tiles are considered connected
    }
    
    // Create a set of tile positions for quick lookup
    const tilePositions = new Set();
    const positionToTile = new Map();
    
    boardData.forEach(tile => {
        const posKey = `${tile.col},${tile.row}`;
        tilePositions.add(posKey);
        positionToTile.set(posKey, tile);
    });
    
    // Start BFS from the first tile
    const startPos = `${boardData[0].col},${boardData[0].row}`;
    const visited = new Set();
    const queue = [startPos];
    visited.add(startPos);
    
    // Directions: up, down, left, right
    const directions = [
        [0, 1],   // up
        [0, -1],  // down
        [-1, 0],  // left
        [1, 0]    // right
    ];
    
    while (queue.length > 0) {
        const currentPos = queue.shift();
        const [currentX, currentY] = currentPos.split(',').map(Number);
        
        // Check all 4 adjacent positions
        directions.forEach(([dx, dy]) => {
            const newX = currentX + dx;
            const newY = currentY + dy;
            const newPos = `${newX},${newY}`;
            
            // If there's a tile at this position and we haven't visited it
            if (tilePositions.has(newPos) && !visited.has(newPos)) {
                visited.add(newPos);
                queue.push(newPos);
            }
        });
    }
    
    // All tiles are connected if we visited all of them
    const allConnected = visited.size === boardData.length;
    
    console.log(`Connectivity check: ${visited.size}/${boardData.length} tiles reachable`);
    if (!allConnected) {
        console.log('Unreachable tiles:', boardData.filter(tile => 
            !visited.has(`${tile.col},${tile.row}`)
        ).map(tile => `${tile.letter} at ${tile.col},${tile.row}`));
    }
    
    return allConnected;
}

// Extract all words from board tiles for spell checking
function extractWordsFromBoard(boardData) {
    if (!boardData || boardData.length === 0) {
        return [];
    }
    
    // Create a grid representation
    const grid = new Map();
    let minRow = Infinity, maxRow = -Infinity;
    let minCol = Infinity, maxCol = -Infinity;
    
    // Populate grid and find bounds
    boardData.forEach(tile => {
        const key = `${tile.row},${tile.col}`;
        grid.set(key, tile.letter);
        minRow = Math.min(minRow, tile.row);
        maxRow = Math.max(maxRow, tile.row);
        minCol = Math.min(minCol, tile.col);
        maxCol = Math.max(maxCol, tile.col);
    });
    
    const words = [];
    
    // Extract horizontal words
    for (let row = minRow; row <= maxRow; row++) {
        let currentWord = '';
        let wordPositions = [];
        
        for (let col = minCol; col <= maxCol + 1; col++) {
            const key = `${row},${col}`;
            const letter = grid.get(key);
            
            if (letter) {
                currentWord += letter;
                wordPositions.push({ row, col });
            } else {
                // End of word or gap
                if (currentWord.length >= 2) {
                    words.push({
                        word: currentWord.toLowerCase(),
                        positions: [...wordPositions],
                        direction: 'horizontal'
                    });
                }
                currentWord = '';
                wordPositions = [];
            }
        }
    }
    
    // Extract vertical words
    for (let col = minCol; col <= maxCol; col++) {
        let currentWord = '';
        let wordPositions = [];
        
        for (let row = minRow; row <= maxRow + 1; row++) {
            const key = `${row},${col}`;
            const letter = grid.get(key);
            
            if (letter) {
                currentWord += letter;
                wordPositions.push({ row, col });
            } else {
                // End of word or gap
                if (currentWord.length >= 2) {
                    words.push({
                        word: currentWord.toLowerCase(),
                        positions: [...wordPositions],
                        direction: 'vertical'
                    });
                }
                currentWord = '';
                wordPositions = [];
            }
        }
    }
    
    console.log(`Extracted ${words.length} words from board:`, words.map(w => w.word));
    return words;
}

// Calculate player's score based on valid words on their board
function calculatePlayerScore(boardData) {
    if (!boardData || boardData.length === 0) {
        return { totalScore: 0, wordScores: [], tileScore: 0, lengthBonus: 0 };
    }
    
    // Extract all words from the board
    const words = extractWordsFromBoard(boardData);
    
    // Filter for valid words (spell check)
    const validWords = words.filter(wordObj => {
        const isValid = dictionary.isValidWord(wordObj.word);
        console.log(`Word "${wordObj.word}" is ${isValid ? 'valid' : 'invalid'}`);
        return isValid;
    });
    
    let tileScore = 0;
    let lengthBonus = 0;
    const wordScores = [];
    const countedPositions = new Set(); // Track positions to avoid double-counting tiles
    
    // Calculate tile scores for each valid word
    validWords.forEach(wordObj => {
        let wordTileScore = 0;
        const wordLength = wordObj.word.length;
        
        // Add tile values for each letter in valid words
        wordObj.positions.forEach(pos => {
            const posKey = `${pos.row},${pos.col}`;
            if (!countedPositions.has(posKey)) {
                const tile = boardData.find(t => t.row === pos.row && t.col === pos.col);
                if (tile) {
                    const letterValue = TILE_VALUES[tile.letter] || 0;
                    wordTileScore += letterValue;
                    countedPositions.add(posKey);
                }
            }
        });
        
        // Calculate length bonus (5 points for 5-letter words, 10 for 6-letter, etc.)
        let wordLengthBonus = 0;
        if (wordLength >= 5) {
            wordLengthBonus = (wordLength - 4) * 5;
        }
        
        const wordTotalScore = wordTileScore + wordLengthBonus;
        
        wordScores.push({
            word: wordObj.word,
            length: wordLength,
            tileScore: wordTileScore,
            lengthBonus: wordLengthBonus,
            totalScore: wordTotalScore
        });
        
        tileScore += wordTileScore;
        lengthBonus += wordLengthBonus;
        
        console.log(`Word "${wordObj.word}" (${wordLength} letters): ${wordTileScore} tile points + ${wordLengthBonus} length bonus = ${wordTotalScore} total`);
    });
    
    const totalScore = tileScore + lengthBonus;
    
    console.log(`Player board score: ${tileScore} tile points + ${lengthBonus} length bonus = ${totalScore} total`);
    
    return {
        totalScore,
        wordScores,
        tileScore,
        lengthBonus,
        validWordCount: validWords.length
    };
}

// Handle board submission
function handleBoardSubmission(socket, user, table, data) {
    const gameState = table.gameState;
    const player = gameState.players.find(p => p.username === user.username);
    
    if (!player || player.resigned) {
        socket.emit('error', 'You are not in this game');
        return;
    }
    
    if (!data.boardData || data.boardData.length === 0) {
        socket.emit('error', 'No tiles to submit');
        return;
    }
    
    console.log(`${user.username} submitting ${data.boardData.length} tiles for validation`);
    
    // Check if all tiles are connected
    const isConnected = checkTilesConnected(data.boardData);
    console.log(`Connectivity check: ${isConnected ? 'PASSED' : 'FAILED'}`);
    
    // Check spelling of all words
    let isSpellingValid = true;
    let invalidWords = [];
    
    if (isConnected) {
        const extractedWords = extractWordsFromBoard(data.boardData);
        
        for (const wordInfo of extractedWords) {
            if (!dictionary.isValidWord(wordInfo.word)) {
                isSpellingValid = false;
                invalidWords.push(wordInfo);
                console.log(`Invalid word found: "${wordInfo.word}" (${wordInfo.direction})`);
            }
        }
        
        console.log(`Spell check: ${isSpellingValid ? 'PASSED' : 'FAILED'}`);
        if (invalidWords.length > 0) {
            console.log(`Invalid words: ${invalidWords.map(w => w.word).join(', ')}`);
        }
    }
    
    const isValid = isConnected && isSpellingValid;
    
    if (isValid) {
        // Tiles remain temporary/rearrangeable - players can always move them
        console.log(`${user.username}'s submission validated - ${data.boardData.length} tiles approved on their private board`);
        
        // Track successful submission and store board data for scoring
        player.validSubmissions++;
        player.lastValidBoard = [...data.boardData]; // Store a copy of the valid board data
        
        // Check for game over condition BEFORE dealing new tiles:
        // if submitting player has no tiles in hand AND no tiles remain in pool, they win
        const availablePoolTiles = getAvailablePoolTiles(gameState);
        if (player.hand.length === 0 && availablePoolTiles.length === 0) {
            handleGameOver(table, gameState, user.username);
            return; // Exit early - game is over
        }
        
        // Deal one new tile to each player (only if game continues)
        dealNewTileToAllPlayers(gameState);
        
        // Notify all players about successful submission
        io.to(`table-${table.id}`).emit('board-submitted-success', {
            submitterId: user.username,
            tilesSubmitted: data.boardData.length,
            message: 'NEXT!!'
        });
        
        // Send updated game state to all players
        broadcastGameStateUpdate(table.id, gameState);
        
        console.log(`${user.username} successfully submitted ${data.boardData.length} tiles`);
    } else {
        // Handle failed submission
        let failureReason;
        let failureDetails = {};
        
        if (!isConnected) {
            failureReason = 'All tiles must be connected to each other';
        } else if (!isSpellingValid) {
            failureReason = `Invalid words found: ${invalidWords.map(w => w.word.toUpperCase()).join(', ')}`;
            failureDetails.invalidWords = invalidWords;
        }
        
        socket.emit('board-submission-failed', {
            reason: failureReason,
            invalidTiles: [],
            ...failureDetails
        });
        
        console.log(`${user.username}'s submission failed: ${failureReason}`);
    }
}

// Deal one new tile to each player
function dealNewTileToAllPlayers(gameState) {
    const availablePoolTiles = getAvailablePoolTiles(gameState);
    
    // Don't modify any existing tile states - just deal new tiles
    gameState.players.forEach(player => {
        if (player.resigned || availablePoolTiles.length === 0) return;
        
        // Get a random tile from the pool
        const randomIndex = Math.floor(Math.random() * availablePoolTiles.length);
        const newTile = availablePoolTiles[randomIndex];
        
        // Create a copy for the hand without modifying the original tile
        const handTile = {
            id: newTile.id,
            letter: newTile.letter
        };
        
        // Add to player's hand (don't modify the allTiles entry)
        player.hand.push(handTile);
        
        // Update only the pool tile's state
        newTile.state = 'hand';
        newTile.playerId = player.username;
        
        // Remove from available pool
        availablePoolTiles.splice(randomIndex, 1);
        
        console.log(`${player.username} received new tile: ${newTile.id}(${newTile.letter})`);
    });
}

// Handle game over condition
function handleGameOver(table, gameState, winnerUsername) {
    console.log(`Game over! Winner: ${winnerUsername}`);
    
    // Update game state
    gameState.status = 'finished';
    gameState.winner = winnerUsername;
    
    // Calculate final statistics for each player
    const finalStats = gameState.players.map(player => {
        // Count tiles currently on board and get last valid board for scoring
        let tilesOnBoard = 0;
        gameState.allTiles.forEach(tile => {
            if (tile.state === 'board' && tile.boardOwner === player.username) {
                tilesOnBoard++;
            }
        });
        
        console.log(`=== SCORING DEBUG FOR ${player.username} ===`);
        console.log(`Tiles on board: ${tilesOnBoard}`);
        console.log(`Last valid board data:`, player.lastValidBoard);
        
        // Use the last valid board submission for scoring, or empty array if none
        const boardData = player.lastValidBoard || [];
        
        console.log(`Using board data for scoring (${boardData.length} tiles):`, boardData);
        console.log(`=== END SCORING DEBUG ===`);
        
        // Calculate player's score (only if they have submitted a valid board)
        const scoreData = boardData.length > 0 ? calculatePlayerScore(boardData) : {
            totalScore: 0,
            wordScores: [],
            tileScore: 0,
            lengthBonus: 0,
            validWordCount: 0
        };
        
        return {
            username: player.username,
            isWinner: player.username === winnerUsername,
            tilesOnBoard: tilesOnBoard,
            tilesInHand: player.hand.length,
            tilesTrashCount: player.tilesTrashCount,
            validSubmissions: player.validSubmissions,
            score: scoreData.totalScore,
            scoreBreakdown: {
                tileScore: scoreData.tileScore,
                lengthBonus: scoreData.lengthBonus,
                validWordCount: scoreData.validWordCount,
                wordScores: scoreData.wordScores
            }
        };
    });
    
    // Notify all players of game over
    io.to(`table-${table.id}`).emit('game-over', {
        winner: winnerUsername,
        playerStats: finalStats,
        message: `🎉 ${winnerUsername} wins the game! 🎉`
    });
    
    console.log('Game over data sent to all players:', {
        winner: winnerUsername,
        playerStats: finalStats
    });
}

// Handle tile placement on board
function handleTilePlacement(socket, user, table, data) {
    const gameState = table.gameState;
    const player = gameState.players.find(p => p.username === user.username);
    
    if (!player || player.resigned) {
        socket.emit('error', 'You are not in this game');
        return;
    }
    
    // Debug: Log current hand state
    console.log(`=== TILE PLACEMENT DEBUG ===`);
    console.log(`User: ${user.username}, trying to place tile: ${data.tileId}`);
    console.log(`Current hand:`, player.hand.map(t => `${t.id}(${t.letter})`));
    console.log(`Tile ${data.tileId} current state in allTiles:`, gameState.allTiles.get(data.tileId));

    // Find the tile in player's hand
    const handTileIndex = player.hand.findIndex(handTile => handTile.id === data.tileId);
    if (handTileIndex === -1) {
        console.log(`ERROR: Tile ${data.tileId} not found in ${user.username}'s hand`);
        console.log(`Available hand tiles:`, player.hand.map(t => `${t.id}(${t.letter})`));
        socket.emit('error', 'Tile not found in hand');
        return;
    }
    
    const handTile = player.hand[handTileIndex];
    const tile = gameState.allTiles.get(data.tileId);
    
    if (!tile || tile.state !== 'hand' || tile.playerId !== player.username) {
        console.log(`ERROR: Invalid tile state - tile ${data.tileId} state: ${tile?.state}, playerId: ${tile?.playerId}`);
        socket.emit('error', 'Invalid tile state for placement');
        return;
    }
    
    // Log the placement action
    console.log(`${player.username} placed tile ${data.tileId} (${tile.letter}) at ${data.x},${data.y} on their private board`);
    
    // Update tile state to 'board' with board owner info
    tile.state = 'board';
    tile.position = { x: data.x, y: data.y };
    tile.boardOwner = player.username; // Track which player's board this tile is on
    
    // Remove tile from player's hand
    player.hand.splice(handTileIndex, 1);
    
    // Log current game state
    logPlayerTileStates(gameState, player.username);
    
    // Only notify the specific player about their tile placement (private boards)
    socket.emit('tile-placed-on-my-board', {
        tileId: data.tileId,
        tile: tile,
        x: data.x,
        y: data.y
    });
    
    // Send updated game state to all players
    broadcastGameStateUpdate(table.id, gameState);
}

// Handle returning tile from board to hand
function handleTileReturnToHand(socket, user, table, data) {
    const gameState = table.gameState;
    const player = gameState.players.find(p => p.username === user.username);
    
    if (!player || player.resigned) {
        socket.emit('error', 'You are not in this game');
        return;
    }
    
    // Find the tile in allTiles
    let tile = gameState.allTiles.get(data.tileId);
    if (!tile) {
        tile = gameState.allTiles.get(Number(data.tileId)) || gameState.allTiles.get(String(data.tileId));
    }
    
    if (!tile || tile.state !== 'board' || tile.boardOwner !== player.username) {
        console.log(`ERROR: Cannot return tile ${data.tileId} - not found on ${player.username}'s board`);
        socket.emit('error', 'Invalid tile for return to hand');
        return;
    }
    
    console.log(`${player.username} returning tile ${tile.id}(${tile.letter}) from board to hand`);
    
    // Update tile state back to 'hand'
    tile.state = 'hand';
    tile.position = null;
    tile.boardOwner = null;
    
    // Add tile back to player's hand
    const handTile = {
        id: tile.id,
        letter: tile.letter
    };
    player.hand.push(handTile);
    
    // Log current game state
    logPlayerTileStates(gameState, player.username);
    
    // Send updated game state to all players
    broadcastGameStateUpdate(table.id, gameState);
}

// Handle moving a tile from one board position to another
function handleTileMoveOnBoard(socket, user, table, data) {
    const gameState = table.gameState;
    const player = gameState.players.find(p => p.username === user.username);
    
    if (!player || player.resigned) {
        socket.emit('error', 'You are not in this game');
        return;
    }
    
    console.log(`=== TILE MOVE ON BOARD DEBUG ===`);
    console.log(`User: ${user.username}, moving tile: ${data.tileId} from ${data.fromX},${data.fromY} to ${data.toX},${data.toY}`);
    
    const tile = gameState.allTiles.get(data.tileId);
    
    if (!tile || tile.state !== 'board' || tile.boardOwner !== player.username) {
        console.log(`ERROR: Invalid tile for board move - tile ${data.tileId} state: ${tile?.state}, boardOwner: ${tile?.boardOwner}`);
        socket.emit('error', 'Invalid tile for board movement');
        return;
    }
    
    // Verify the tile is at the expected source position
    if (tile.position.x !== data.fromX || tile.position.y !== data.fromY) {
        console.log(`ERROR: Tile position mismatch - expected ${data.fromX},${data.fromY}, actual ${tile.position.x},${tile.position.y}`);
        socket.emit('error', 'Tile position mismatch');
        return;
    }
    
    console.log(`${player.username} moved tile ${data.tileId} (${tile.letter}) from ${data.fromX},${data.fromY} to ${data.toX},${data.toY} on their private board`);
    
    // Update tile position
    tile.position = { x: data.toX, y: data.toY };
    
    // Log current game state
    logPlayerTileStates(gameState, player.username);
    
    // Notify the player about the tile move
    socket.emit('tile-moved-on-board', {
        tileId: data.tileId,
        tile: tile,
        fromX: data.fromX,
        fromY: data.fromY,
        toX: data.toX,
        toY: data.toY
    });
    
    // Send updated game state to all players
    broadcastGameStateUpdate(table.id, gameState);
}

// Log current tile states for debugging
function logPlayerTileStates(gameState, username) {
    const player = gameState.players.find(p => p.username === username);
    if (!player) return;
    
    // Log tiles in hand
    const handTiles = player.hand.map(tile => `${tile.id}(${tile.letter})`).join(',');
    console.log(`tiles in hand: ${handTiles}`);
    
    // Log tiles on this player's board
    const boardTiles = [];
    for (const [tileId, tile] of gameState.allTiles) {
        if (tile.state === 'board' && tile.boardOwner === username) {
            boardTiles.push(`${tile.id}(${tile.letter})`);
        }
    }
    console.log(`tiles on ${username}'s board: ${boardTiles.join(',')}`);
}

// Handle tile trashing - return 1 tile, get 3 new ones
function handleTileTrash(socket, user, table, data) {
    const gameState = table.gameState;
    const player = gameState.players.find(p => p.username === user.username);
    
    if (!player || player.resigned) {
        socket.emit('error', 'You are not in this game');
        return;
    }
    
    console.log(`${user.username} attempting to trash tile ID: ${data.tileId} (type: ${typeof data.tileId})`);
    console.log(`Current hand: ${player.hand.map(t => `${t.id}(${t.letter}) [type: ${typeof t.id}]`).join(', ')}`);
    
    // Find the tile by ID in player's hand (ensure type compatibility)
    const tileIdToFind = String(data.tileId);
    const handTileIndex = player.hand.findIndex(handTile => String(handTile.id) === tileIdToFind);
    if (handTileIndex === -1) {
        console.log(`ERROR: Tile ${data.tileId} not found in ${user.username}'s hand after type conversion`);
        console.log(`Hand tile IDs: ${player.hand.map(t => String(t.id)).join(', ')}`);
        socket.emit('error', 'Tile not found in hand');
        return;
    }
    
    console.log(`Found tile at hand index ${handTileIndex}`);
    
    // Count available tiles in pool
    const availablePoolTiles = getAvailablePoolTiles(gameState);
    if (availablePoolTiles.length < 3) {
        socket.emit('error', 'Not enough tiles in pool to exchange');
        return;
    }
    
    // Get the tile being trashed (try both string and number keys)
    let trashedTile = gameState.allTiles.get(data.tileId);
    if (!trashedTile) {
        // Try with number key if string key failed
        trashedTile = gameState.allTiles.get(Number(data.tileId));
    }
    if (!trashedTile) {
        // Try with string key if number key failed
        trashedTile = gameState.allTiles.get(String(data.tileId));
    }
    
    console.log(`Tile ${data.tileId} in allTiles:`, trashedTile ? {
        id: trashedTile.id,
        letter: trashedTile.letter,
        state: trashedTile.state,
        playerId: trashedTile.playerId
    } : 'NOT FOUND');
    
    if (!trashedTile) {
        console.log('ERROR: Tile not found in allTiles map');
        socket.emit('error', 'Invalid tile state for trashing');
        return;
    }
    
    if (trashedTile.state !== 'hand') {
        console.log(`ERROR: Tile state is '${trashedTile.state}', expected 'hand'`);
        socket.emit('error', 'Invalid tile state for trashing');
        return;
    }
    
    if (trashedTile.playerId !== player.username) {
        console.log(`ERROR: Tile belongs to '${trashedTile.playerId}', expected '${player.username}'`);
        socket.emit('error', 'Invalid tile state for trashing');
        return;
    }
    
    console.log(`${player.username} trashing tile ${trashedTile.id} (${trashedTile.letter})`);
    
    // Remove tile from player's hand
    player.hand.splice(handTileIndex, 1);
    
    // Return trashed tile to the pool
    trashedTile.state = 'pool';
    trashedTile.playerId = null;
    trashedTile.position = null;
    
    // Deal 3 new tiles from the pool
    const shuffledPoolTiles = shuffleArray(availablePoolTiles);
    const newTiles = [];
    
    for (let i = 0; i < 3 && shuffledPoolTiles.length > 0; i++) {
        const poolTile = shuffledPoolTiles[i];
        
        // Update tile state
        poolTile.state = 'hand';
        poolTile.playerId = player.username;
        
        // Add to player's hand
        const handTile = {
            id: poolTile.id,
            letter: poolTile.letter
        };
        
        player.hand.push(handTile);
        newTiles.push(handTile);
    }
    
    console.log(`${player.username} received ${newTiles.length} new tiles: ${newTiles.map(t => t.letter).join(', ')}`);
    
    // Update tile tray reference
    gameState.tileTray = getAvailablePoolTiles(gameState);
    
    // Track trashed tile count
    player.tilesTrashCount++;
    
    // Notify the player of the successful exchange
    socket.emit('tile-exchange-complete', {
        trashedTile: trashedTile,
        newTiles: newTiles,
        newHandSize: player.hand.length,
        tilesRemaining: gameState.tileTray.length
    });
    
    // Send updated game state to all players
    broadcastGameStateUpdate(table.id, gameState);
    
    console.log(`${user.username} trashed tile ${trashedTile.letter} and received ${newTiles.length} new tiles`);
}

// Broadcast updated game state to all players in a table
function broadcastGameStateUpdate(tableId, gameState) {
    // Convert Maps to objects for proper serialization
    const serializedGameState = {
        ...gameState,
        allTiles: gameState.allTiles ? Object.fromEntries(gameState.allTiles) : {},
        board: gameState.board ? Object.fromEntries(gameState.board) : {},
        // Keep players as array since it was initialized as array
        players: gameState.players || []
    };
    
    console.log(`Broadcasting game state update - allTiles: ${gameState.allTiles?.size || 0}, board: ${gameState.board?.size || 0}`);
    
    io.to(`table-${tableId}`).emit('game-state-updated', {
        gameState: serializedGameState
    });
}

// Helper function to get all available tiles in the pool
function getAvailablePoolTiles(gameState) {
    const poolTiles = [];
    if (gameState.allTiles) {
        gameState.allTiles.forEach(tile => {
            if (tile.state === 'pool') {
                poolTiles.push(tile);
            }
        });
    }
    return poolTiles;
}

// Helper function to validate tile state integrity
function validateTileState(gameState) {
    const states = { pool: 0, hand: 0, board: 0 };
    
    gameState.allTiles.forEach(tile => {
        states[tile.state]++;
    });
    
    console.log(`Tile state check: Pool=${states.pool}, Hand=${states.hand}, Board=${states.board}, Total=${states.pool + states.hand + states.board}`);
    return states;
}

// Check if game should end (no tiles in pool and one player has empty hand)
function checkGameEndCondition(gameState) {
    const poolTiles = getAvailablePoolTiles(gameState);
    
    // Game ends if pool is empty AND at least one player has no tiles in hand
    if (poolTiles.length === 0) {
        const emptyHandPlayer = gameState.players.find(player => player.hand.length === 0);
        if (emptyHandPlayer) {
            return { shouldEnd: true, winner: emptyHandPlayer.username, reason: 'Pool empty and player finished' };
        }
    }
    
    return { shouldEnd: false };
}

// Handle placing a tile from hand to board
function placeTileOnBoard(gameState, playerId, tileId, x, y) {
    const tile = gameState.allTiles.get(tileId);
    const player = gameState.players.find(p => p.username === playerId);
    
    if (!tile || !player) {
        return { success: false, error: 'Invalid tile or player' };
    }
    
    if (tile.state !== 'hand' || tile.playerId !== playerId) {
        return { success: false, error: 'Tile not in player hand' };
    }
    
    const position = `${x},${y}`;
    
    // Check if position is already occupied
    if (player.board && player.board.tiles.has(position)) {
        return { success: false, error: 'Position already occupied' };
    }
    
    // Update tile state
    tile.state = 'board';
    tile.position = { x, y };
    // playerId stays the same
    
    // Remove from hand
    const handIndex = player.hand.findIndex(h => h.id === tileId);
    if (handIndex >= 0) {
        player.hand.splice(handIndex, 1);
    }
    
    // Add to board
    if (!player.board.tiles) {
        player.board.tiles = new Map();
    }
    player.board.tiles.set(position, {
        id: tileId,
        letter: tile.letter,
        playerId: playerId
    });
    
    console.log(`${playerId} placed tile ${tileId} (${tile.letter}) at ${position}`);
    
    // Check if game should end
    const endCondition = checkGameEndCondition(gameState);
    
    return { 
        success: true, 
        gameEndCondition: endCondition,
        tilesInHand: player.hand.length,
        tilesInPool: getAvailablePoolTiles(gameState).length
    };
}

// Handle moving a tile from board back to hand
function moveTileFromBoardToHand(gameState, playerId, x, y) {
    const player = gameState.players.find(p => p.username === playerId);
    
    if (!player || !player.board || !player.board.tiles) {
        return { success: false, error: 'Invalid player or board' };
    }
    
    const position = `${x},${y}`;
    const boardTile = player.board.tiles.get(position);
    
    if (!boardTile || boardTile.playerId !== playerId) {
        return { success: false, error: 'No tile at position or not owned by player' };
    }
    
    const tile = gameState.allTiles.get(boardTile.id);
    
    if (!tile || tile.state !== 'board') {
        return { success: false, error: 'Invalid tile state' };
    }
    
    // Update tile state
    tile.state = 'hand';
    tile.position = null;
    // playerId stays the same
    
    // Remove from board
    player.board.tiles.delete(position);
    
    // Add to hand
    player.hand.push({
        id: tile.id,
        letter: tile.letter
    });
    
    console.log(`${playerId} moved tile ${tile.id} (${tile.letter}) from board back to hand`);
    
    return { success: true };
}

// End game and return all players to lobby
function endGameAndReturnToLobby(tableId, reason = 'Game ended') {
    const table = gameTables.get(tableId);
    if (!table) return;

    // Notify all players in the table to return to lobby
    io.to(`table-${tableId}`).emit('return-to-lobby', {
        reason: reason
    });

    // Remove all players from the table room
    const sockets = io.sockets.sockets;
    sockets.forEach(socket => {
        if (socket.rooms.has(`table-${tableId}`)) {
            socket.leave(`table-${tableId}`);
        }
    });

    // Delete the table immediately
    gameTables.delete(tableId);

    // Update lobby with current tables
    io.to('lobby').emit('table-deleted', {
        tableId: tableId,
        tables: Array.from(gameTables.values())
    });

    console.log(`Game ended and players returned to lobby for table: ${table.name} - ${reason}`);
}

// End game (keep for other use cases)
function endGame(tableId) {
    const table = gameTables.get(tableId);
    if (!table || !table.gameState) return;

    table.status = 'finished';
    table.gameState.status = 'finished';
    table.gameState.endTime = new Date();

    // Notify players
    io.to(`table-${tableId}`).emit('game-ended', {
        gameState: table.gameState
    });

    // Update lobby
    io.to('lobby').emit('table-updated', {
        table: table,
        tables: Array.from(gameTables.values())
    });

    // Clean up game after 30 seconds
    setTimeout(() => {
        gameTables.delete(tableId);
        io.to('lobby').emit('table-deleted', {
            tableId: tableId,
            tables: Array.from(gameTables.values())
        });
    }, 30000);

    console.log(`Game ended for table: ${table.name}`);
}

// Load dictionary and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        console.log('Loading dictionary...');
        await dictionary.loadDictionary();
        console.log('Dictionary loaded successfully');
        
        server.listen(PORT, () => {
            console.log(`SpeedWurdz server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to load dictionary:', error);
        process.exit(1);
    }
}

startServer();