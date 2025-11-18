// Socket.io connection
const socket = io();

// DOM elements
const usernameScreen = document.getElementById('username-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const tableScreen = document.getElementById('table-screen');
const gameScreen = document.getElementById('game-screen');
const usernameInput = document.getElementById('username-input');
const joinLobbyBtn = document.getElementById('join-lobby-btn');
const usernameError = document.getElementById('username-error');
const currentUsernameSpan = document.getElementById('current-username');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
const usersList = document.getElementById('users-list');
const userCount = document.getElementById('user-count');
const tablesList = document.getElementById('tables-list');
const tableCount = document.getElementById('table-count');
const createTableBtn = document.getElementById('create-table-btn');
const createTableModal = document.getElementById('create-table-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelCreateBtn = document.getElementById('cancel-create-btn');
const confirmCreateBtn = document.getElementById('confirm-create-btn');
const tableNameInput = document.getElementById('table-name');
const maxPlayersSelect = document.getElementById('max-players');
const startingTilesInput = document.getElementById('starting-tiles');
const tableTitle = document.getElementById('table-title');
const leaveTableBtn = document.getElementById('leave-table-btn');
const startGameBtn = document.getElementById('start-game-btn');
const playersList = document.getElementById('players-list');
const playersCount = document.getElementById('players-count');
const maxPlayersDisplay = document.getElementById('max-players-display');
const statusMessage = document.getElementById('status-message');

// Game screen elements
const countdownOverlay = document.getElementById('countdown-overlay');
const waitingOverlay = document.getElementById('waiting-overlay');
const countdownTimer = document.getElementById('countdown-timer');
const startGameplayBtn = document.getElementById('start-gameplay-btn');
const waitingForHostBtn = document.getElementById('waiting-for-host-btn');
const gameTableName = document.getElementById('game-table-name');
const gameTimer = document.getElementById('game-timer');
// const playerScore = document.getElementById('player-score'); // Removed - element no longer exists
const gameBoard = document.getElementById('game-board');
const viewXSpan = document.getElementById('view-x');
const viewYSpan = document.getElementById('view-y');
const playerHand = document.getElementById('player-hand');
const handCount = document.getElementById('hand-count');
const boardTileCount = document.getElementById('board-tile-count');
const remainingTilesCount = document.getElementById('remaining-tiles-count');
const trashTileBtn = document.getElementById('trash-tile-btn');
const resignGameBtn = document.getElementById('resign-game-btn');
const gameOverModal = document.getElementById('game-over-modal');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverMessage = document.getElementById('game-over-message');
const playerStats = document.getElementById('player-stats');
const returnToLobbyBtn = document.getElementById('return-to-lobby-btn');
const scrollUpBtn = document.getElementById('scroll-up');
const scrollDownBtn = document.getElementById('scroll-down');
const scrollLeftBtn = document.getElementById('scroll-left');
const scrollRightBtn = document.getElementById('scroll-right');
const refreshHandBtn = document.getElementById('refresh-hand-btn');
const refreshBoardBtn = document.getElementById('refresh-board-btn');
const soundToggleBtn = document.getElementById('sound-toggle-btn');
const instructionsBtn = document.getElementById('instructions-btn');
const instructionsModal = document.getElementById('instructions-modal');
const instructionsCloseBtn = document.getElementById('instructions-close');

// Tile placement elements
const submitBoardBtn = document.getElementById('submit-board-btn');
const directionArrows = document.getElementById('direction-arrows');

// State
let currentUsername = '';
let currentTable = null;
let isHost = false;
let gameState = null;
let playerBoard = null;
let viewPosition = { x: 0, y: 0 };
let gameStartTime = null;
let gameTimerInterval = null;
let selectedHandTile = null;
let selectedBoardTile = null; // {x, y, tileData} for board tile selection
let typingPosition = null;
let typingDirection = null;
let placedTiles = new Map(); // Map of "x,y" -> tileData for tiles placed on board
let directionArrowTimer = null; // Timer for auto-fading direction arrows

// Event Listeners
joinLobbyBtn.addEventListener('click', joinLobby);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinLobby();
});

leaveLobbyBtn.addEventListener('click', leaveLobby);
createTableBtn.addEventListener('click', showCreateTableModal);
closeModalBtn.addEventListener('click', hideCreateTableModal);
cancelCreateBtn.addEventListener('click', hideCreateTableModal);
confirmCreateBtn.addEventListener('click', createTable);
leaveTableBtn.addEventListener('click', leaveTable);
startGameBtn.addEventListener('click', startGame);

// Game screen event listeners
resignGameBtn.addEventListener('click', resignGame);
trashTileBtn.addEventListener('click', trashTile);
soundToggleBtn.addEventListener('click', toggleSounds);
scrollUpBtn.addEventListener('click', () => scrollBoard('up', 1));
scrollDownBtn.addEventListener('click', () => scrollBoard('down', 1));
scrollLeftBtn.addEventListener('click', () => scrollBoard('left', 1));
scrollRightBtn.addEventListener('click', () => scrollBoard('right', 1));
refreshHandBtn?.addEventListener('click', () => refreshHand());
refreshBoardBtn?.addEventListener('click', () => refreshBoard());
startGameplayBtn.addEventListener('click', startGameplay);

// Instructions modal listeners
instructionsBtn?.addEventListener('click', showInstructionsModal);
instructionsCloseBtn?.addEventListener('click', hideInstructionsModal);

// Tile placement event listeners
submitBoardBtn.addEventListener('click', submitBoard);

// Trash tile drop target listeners
trashTileBtn.addEventListener('dragover', handleTrashDragOver);
trashTileBtn.addEventListener('drop', handleTrashDrop);
trashTileBtn.addEventListener('dragleave', handleTrashDragLeave);

// Player hand drop target listeners (for returning tiles to hand)
playerHand.addEventListener('dragover', handleHandDragOver);
playerHand.addEventListener('drop', handleHandDrop);
playerHand.addEventListener('dragleave', handleHandDragLeave);

// Game over modal listener
returnToLobbyBtn?.addEventListener('click', returnToLobbyFromGameOver);

// Keyboard listener for typing mode
document.addEventListener('keydown', handleKeyboardInput);

// One-time audio context initialization on first user interaction
document.addEventListener('click', () => {
    gameSounds.resumeContext();
}, { once: true });

// Modal backdrop click
createTableModal.addEventListener('click', (e) => {
    if (e.target === createTableModal) {
        hideCreateTableModal();
    }
});

// Instructions modal backdrop click
instructionsModal?.addEventListener('click', (e) => {
    if (e.target === instructionsModal) {
        hideInstructionsModal();
    }
});

// Update starting tiles default when max players changes
maxPlayersSelect.addEventListener('change', updateStartingTilesDefault);

// Helper function to safely get current player from either array or Map
function getCurrentPlayer() {
    if (!gameState?.players || !currentUsername) return null;
    
    // Handle Map format (after client-side conversion)
    if (gameState.players.get) {
        return gameState.players.get(currentUsername);
    }
    
    // Handle array format (direct from server)
    if (Array.isArray(gameState.players)) {
        return gameState.players.find(p => p.username === currentUsername);
    }
    
    return null;
}

// Socket event handlers
socket.on('lobby-joined', (data) => {
    currentUsername = data.username;
    currentUsernameSpan.textContent = data.username;
    showScreen('lobby');
    updateUsersList(data.users);
    updateTablesList(data.tables);
    showStatusMessage('Welcome to the lobby!', 'success');
});

socket.on('user-joined', (data) => {
    updateUsersList(data.users);
    showStatusMessage(`${data.username} joined the lobby`, 'info');
});

socket.on('user-left', (data) => {
    updateUsersList(data.users);
    showStatusMessage(`${data.username} left the lobby`, 'info');
});

socket.on('table-created', (data) => {
    updateTablesList(data.tables);
    showStatusMessage(`Table "${data.table.name}" created`, 'success');
});

socket.on('table-updated', (data) => {
    updateTablesList(data.tables);
});

socket.on('table-deleted', (data) => {
    updateTablesList(data.tables);
});

socket.on('tables-updated', (data) => {
    updateTablesList(data.tables);
});

socket.on('table-joined', (table) => {
    currentTable = table;
    isHost = table.host === currentUsername;
    showScreen('table');
    updateTableView(table);
    showStatusMessage(`Joined table "${table.name}"`, 'success');
});

socket.on('player-joined', (data) => {
    currentTable = data.table;
    updateTableView(data.table);
    showStatusMessage(`${data.username} joined the table`, 'info');
    
    // Play join sound (but not for the current user joining)
    if (data.username !== currentUsername) {
        gameSounds.playPlayerJoined();
    }
});

socket.on('player-left', (data) => {
    currentTable = data.table;
    isHost = data.table.host === currentUsername;
    updateTableView(data.table);
    showStatusMessage(`${data.username} left the table`, 'info');
});

socket.on('error', (message) => {
    if (usernameScreen.classList.contains('active')) {
        usernameError.textContent = message;
    } else {
        showStatusMessage(message, 'error');
    }
});

// Game-specific socket events
socket.on('enter-game', (data) => {
    gameState = data.gameState;
    gameTableName.textContent = data.table.name;
    
    // Find current player's board (handle both array and Map formats)
    let currentPlayer;
    if (gameState.players && gameState.players.get) {
        // It's already a Map
        currentPlayer = gameState.players.get(currentUsername);
    } else if (Array.isArray(gameState.players)) {
        // It's still an array, find the player
        currentPlayer = gameState.players.find(p => p.username === currentUsername);
    }
    
    if (currentPlayer) {
        playerBoard = currentPlayer.board;
        viewPosition = { ...playerBoard.viewPosition };
    }
    
    showScreen('game');
    initializeGameBoard();
    
    // Show waiting overlay with appropriate button
    showWaitingOverlay();
    
    showStatusMessage('Entered game! Waiting to start...', 'success');
});

socket.on('countdown-started', (data) => {
    gameState = data.gameState;
    hideWaitingOverlay();
    showCountdownOverlay();
    countdownTimer.textContent = data.gameState.countdownTimer;
    
    // Play initial countdown sound to signal game start sequence
    gameSounds.playCountdownTick();
});

socket.on('countdown-update', (data) => {
    countdownTimer.textContent = data.timer;
    
    // Play countdown sounds
    if (data.timer <= 3 && data.timer > 0) {
        // Urgent sound for last 3 seconds
        gameSounds.playCountdownUrgent();
    } else if (data.timer > 0) {
        // Regular tick sound for other seconds
        gameSounds.playCountdownTick();
    }
});

socket.on('game-started', (data) => {
    console.log('=== GAME STARTED EVENT RECEIVED ===');
    console.log('Game started - received gameState:', data.gameState);
    
    // Play game start sound
    gameSounds.playGameStart();
    
    gameState = data.gameState;
    gameStartTime = new Date(data.gameState.startTime);
    
    // Find current player's board (handle both array and Map formats)
    let currentPlayer;
    if (gameState.players && gameState.players.get) {
        // It's already a Map
        currentPlayer = gameState.players.get(currentUsername);
    } else if (Array.isArray(gameState.players)) {
        // It's still an array, find the player
        currentPlayer = gameState.players.find(p => p.username === currentUsername);
    }
    console.log('Current player data:', currentPlayer);
    
    if (currentPlayer) {
        playerBoard = currentPlayer.board;
        viewPosition = { ...playerBoard.viewPosition };
        console.log(`Player ${currentUsername} has ${currentPlayer.hand?.length || 0} tiles in hand`);
    }
    
    hideCountdownOverlay();
    syncBoardDisplay(); // Load any existing tiles on this player's board
    updateBoardView();
    syncHandDisplay();
    startGameTimer();
    showStatusMessage('Game started! Good luck!', 'success');
});

socket.on('board-updated', (data) => {
    playerBoard = data.board;
    viewPosition = { ...playerBoard.viewPosition };
    updateBoardView();
});

socket.on('player-resigned', (data) => {
    showStatusMessage(`${data.username} has resigned from the game`, 'info');
});

socket.on('return-to-lobby', (data) => {
    stopGameTimer();
    showStatusMessage(data.reason, 'info');
    showScreen('lobby');
    resetGameState();
    currentTable = null;
    isHost = false;
});

socket.on('tile-exchange-complete', (data) => {
    // Show success message
    const newTileLetters = data.newTiles.map(tile => tile.letter).join(', ');
    showStatusMessage(`Trashed ${data.trashedTile.letter}, received: ${newTileLetters}`, 'success');
    
    console.log(`Tile exchange: trashed ${data.trashedTile.letter}, got ${data.newTiles.length} new tiles`);
    
    // Note: Game state will be updated via the 'game-state-updated' event
});

socket.on('game-ended', (data) => {
    stopGameTimer();
    showStatusMessage('Game has ended!', 'info');
    // Return to lobby after a delay
    setTimeout(() => {
        showScreen('lobby');
        resetGameState();
    }, 3000);
});

socket.on('tile-placed-on-my-board', (data) => {
    // This is a tile placed on our own board - no need to update display since we already did it
    console.log(`Confirmed: placed tile ${data.tileId} (${data.tile.letter}) at ${data.x},${data.y} on my board`);
});

socket.on('tile-moved-on-board', (data) => {
    // This is a tile moved on our own board - no need to update display since we already did it
    console.log(`Confirmed: moved tile ${data.tileId} (${data.tile.letter}) from ${data.fromX},${data.fromY} to ${data.toX},${data.toY} on my board`);
});

socket.on('game-state-updated', (data) => {
    // Update our game state with the server's authoritative version
    gameState = data.gameState;
    
    // Convert serialized objects back to Maps for client-side usage
    if (gameState.board && typeof gameState.board === 'object' && !gameState.board.has) {
        gameState.board = new Map(Object.entries(gameState.board));
    }
    
    if (gameState.allTiles && typeof gameState.allTiles === 'object' && !gameState.allTiles.has) {
        gameState.allTiles = new Map(Object.entries(gameState.allTiles));
    }
    
    // Convert players array to Map if needed for consistent client-side access
    if (gameState.players && Array.isArray(gameState.players)) {
        const playersMap = new Map();
        gameState.players.forEach(player => {
            // Keep hand as array - don't convert to Map since server sends arrays
            playersMap.set(player.username, player);
        });
        gameState.players = playersMap;
    }
    
    // Sync the hand display to reflect the server state
    syncHandDisplay();
    
    // Sync the board display to show only our tiles
    syncBoardDisplay();
    
    // Update tile counters
    updateTileCounters();
    
    console.log('Game state synchronized from server');
});

// Debug refresh handlers
socket.on('handUpdate', (handData) => {
    console.log('Received hand update from server:', handData.length, 'tiles');
    
    // Update our local game state
    if (gameState && gameState.players && gameState.players.has && gameState.players.has(currentUsername)) {
        const playerData = gameState.players.get(currentUsername);
        if (playerData) {
            // Keep hand as array since that's what server sends
            playerData.hand = [...handData];
            
            // Refresh the hand display
            syncHandDisplay();
            console.log('Hand display refreshed from server');
        }
    }
});

socket.on('boardUpdate', (boardData) => {
    console.log('Received board update from server:', Object.keys(boardData).length, 'tiles');
    
    // Update our local board state with only our tiles
    if (gameState && gameState.board) {
        // Clear existing tiles that belong to us
        for (let [key, tile] of gameState.board) {
            if (tile.boardOwner === currentUsername) {
                gameState.board.delete(key);
            }
        }
        
        // Add the fresh server data
        Object.keys(boardData).forEach(key => {
            const tile = boardData[key];
            gameState.board.set(key, tile);
        });
        
        // Refresh the board display
        syncBoardDisplay();
        console.log('Board display refreshed from server');
    }
});

socket.on('board-submitted-success', (data) => {
    // Don't mark tiles as permanent - players can always rearrange
    
    // Update board view
    updateBoardView();
    
    // Show flash message
    showFlashMessage(data.message);
    
    // Show success message with submitter info
    if (data.submitterId === currentUsername) {
        showStatusMessage(`Your submission approved! Everyone gets a new tile.`, 'success');
    } else {
        showStatusMessage(`${data.submitterId} submitted ${data.tilesSubmitted} tiles! Everyone gets a new tile.`, 'info');
    }
    
    console.log(`Board submission successful by ${data.submitterId}`);
});

socket.on('board-submission-failed', (data) => {
    showStatusMessage(`Submission failed: ${data.reason}`, 'error');
    console.log('Board submission failed:', data);
});

socket.on('game-over', (data) => {
    console.log('Game over received:', data);
    
    // Disable all game interactions
    gameState.status = 'finished';
    
    // Hide direction arrows if they're showing
    hideDirectionArrows();
    
    // Show the game over modal
    showGameOverModal(data);
});

// Debug function to manually refresh game state
window.debugRefreshGameState = function() {
    console.log('=== MANUAL GAME STATE REFRESH ===');
    if (currentTable) {
        socket.emit('request-game-state', { tableId: currentTable.id });
    } else {
        console.log('No current table');
    }
};

// Debug function to test game over modal
window.debugGameOver = function() {
    console.log('=== TESTING GAME OVER MODAL ===');
    const testData = {
        winner: 'TestPlayer',
        message: '🎉 TestPlayer wins the game! 🎉',
        playerStats: [
            {
                username: 'TestPlayer',
                isWinner: true,
                tilesOnBoard: 25,
                tilesInHand: 0,
                tilesTrashCount: 3,
                validSubmissions: 5,
                score: 85,
                scoreBreakdown: {
                    tileScore: 65,
                    lengthBonus: 20,
                    validWordCount: 8
                }
            },
            {
                username: 'Player2',
                isWinner: false,
                tilesOnBoard: 18,
                tilesInHand: 7,
                tilesTrashCount: 1,
                validSubmissions: 3,
                score: 42,
                scoreBreakdown: {
                    tileScore: 37,
                    lengthBonus: 5,
                    validWordCount: 4
                }
            }
        ]
    };
    showGameOverModal(testData);
};

// Debug function to enable/disable periodic sync
let periodicSyncInterval = null;
window.debugTogglePeriodicSync = function(enable = true) {
    if (periodicSyncInterval) {
        clearInterval(periodicSyncInterval);
        periodicSyncInterval = null;
        console.log('Periodic sync disabled');
    }
    
    if (enable) {
        periodicSyncInterval = setInterval(() => {
            if (currentTable && gameState) {
                console.log('Periodic sync - requesting game state...');
                socket.emit('request-game-state', { tableId: currentTable.id });
            }
        }, 5000); // Every 5 seconds
        console.log('Periodic sync enabled (every 5 seconds)');
    }
};

// Functions
function joinLobby() {
    const username = usernameInput.value.trim();
    if (!username) {
        usernameError.textContent = 'Please enter a username';
        return;
    }
    if (username.length < 2) {
        usernameError.textContent = 'Username must be at least 2 characters';
        return;
    }
    if (username.length > 20) {
        usernameError.textContent = 'Username must be less than 20 characters';
        return;
    }

    usernameError.textContent = '';
    socket.emit('join-lobby', username);
}

function leaveLobby() {
    showScreen('username');
    usernameInput.value = '';
    currentUsername = '';
    currentTable = null;
    isHost = false;
    socket.disconnect();
    socket.connect();
}

function toggleSounds() {
    if (gameSounds.enabled) {
        gameSounds.setEnabled(false);
        soundToggleBtn.textContent = '🔇';
        soundToggleBtn.title = 'Enable sounds';
        showStatusMessage('🔇 Sounds disabled', 'info');
    } else {
        gameSounds.setEnabled(true);
        soundToggleBtn.textContent = '🔊';
        soundToggleBtn.title = 'Disable sounds';
        showStatusMessage('🔊 Sounds enabled', 'info');
        // Play a test sound
        gameSounds.playTileDrop();
    }
}

function showCreateTableModal() {
    createTableModal.classList.add('active');
    createTableModal.style.display = 'flex'; // Explicitly show modal
    tableNameInput.value = `${currentUsername}'s Game`;
    updateStartingTilesDefault(); // Set initial default
    tableNameInput.focus();
}

function hideCreateTableModal() {
    createTableModal.classList.remove('active');
    createTableModal.style.display = 'none'; // Explicitly hide modal
    tableNameInput.value = '';
    maxPlayersSelect.value = '4';
    updateStartingTilesDefault(); // Reset to default
}

function showInstructionsModal() {
    instructionsModal.classList.add('active');
    instructionsModal.style.display = 'flex'; // Explicitly show modal
}

function hideInstructionsModal() {
    instructionsModal.classList.remove('active');
    instructionsModal.style.display = 'none'; // Explicitly hide modal
}

function updateStartingTilesDefault() {
    const maxPlayers = parseInt(maxPlayersSelect.value);
    const defaultTiles = Math.max(75, maxPlayers * 25);
    startingTilesInput.value = defaultTiles;
}

function createTable() {
    const tableName = tableNameInput.value.trim();
    const maxPlayers = parseInt(maxPlayersSelect.value);
    const startingTiles = parseInt(startingTilesInput.value);

    if (!tableName) {
        showStatusMessage('Please enter a table name', 'error');
        return;
    }

    if (startingTiles < 75) {
        showStatusMessage('Starting tiles must be at least 75', 'error');
        return;
    }

    socket.emit('create-table', {
        name: tableName,
        maxPlayers: maxPlayers,
        startingTiles: startingTiles
    });

    hideCreateTableModal();
}

function joinTable(tableId) {
    socket.emit('join-table', tableId);
}

function leaveTable() {
    if (currentTable) {
        socket.emit('leave-table', currentTable.id);
        currentTable = null;
        isHost = false;
        showScreen('lobby');
    }
}

function startGame() {
    if (currentTable) {
        socket.emit('start-game', currentTable.id);
    }
}

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    let targetScreen;
    switch(screenName) {
        case 'username':
            targetScreen = usernameScreen;
            break;
        case 'lobby':
            targetScreen = lobbyScreen;
            break;
        case 'table':
            targetScreen = tableScreen;
            break;
        case 'game':
            targetScreen = gameScreen;
            break;
    }
    
    if (targetScreen) {
        targetScreen.classList.add('active');
        targetScreen.classList.add('screen-transition');
        setTimeout(() => targetScreen.classList.remove('screen-transition'), 500);
    }
}

function updateUsersList(users) {
    userCount.textContent = users.length;
    usersList.innerHTML = '';
    
    users.forEach(username => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-avatar">${username.charAt(0).toUpperCase()}</div>
            <span>${username}${username === currentUsername ? ' (You)' : ''}</span>
        `;
        usersList.appendChild(userItem);
    });
}

function updateTablesList(tables) {
    tableCount.textContent = tables.length;
    tablesList.innerHTML = '';
    
    if (tables.length === 0) {
        tablesList.innerHTML = '<div class="table-item"><p style="text-align: center; color: #718096;">No active tables. Create one to get started!</p></div>';
        return;
    }
    
    tables.forEach(table => {
        const tableItem = document.createElement('div');
        tableItem.className = 'table-item';
        
        const canJoin = table.status === 'waiting' && 
                       table.players.length < table.maxPlayers && 
                       !table.players.includes(currentUsername);
        
        tableItem.innerHTML = `
            <div class="table-info">
                <div class="table-details">
                    <h4>${table.name}</h4>
                    <div class="table-meta">
                        Host: ${table.host} • Created: ${new Date(table.createdAt).toLocaleTimeString()}
                    </div>
                </div>
                <div class="table-status">
                    <span class="status-badge status-${table.status}">${table.status}</span>
                </div>
            </div>
            <div class="players-info">
                Players: ${table.players.join(', ')}
            </div>
            <div class="table-actions">
                <span style="font-size: 14px; color: #718096;">${table.players.length}/${table.maxPlayers} players</span>
                ${canJoin ? `<button class="join-table-btn" onclick="joinTable('${table.id}')">Join Table</button>` : 
                           `<button class="join-table-btn" disabled>Table Full</button>`}
            </div>
        `;
        
        tablesList.appendChild(tableItem);
    });
}

function updateTableView(table) {
    tableTitle.textContent = table.name;
    playersCount.textContent = table.players.length;
    maxPlayersDisplay.textContent = table.maxPlayers;
    
    // Show/hide start game button for host (allow single player games)
    if (isHost && table.players.length >= 1) {
        startGameBtn.style.display = 'block';
    } else {
        startGameBtn.style.display = 'none';
    }
    
    // Update players list
    playersList.innerHTML = '';
    table.players.forEach(playerName => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        const isPlayerHost = playerName === table.host;
        
        playerItem.innerHTML = `
            <div class="player-info">
                <div class="player-avatar">${playerName.charAt(0).toUpperCase()}</div>
                <span>${playerName}${playerName === currentUsername ? ' (You)' : ''}</span>
            </div>
            ${isPlayerHost ? '<span class="host-badge">Host</span>' : ''}
        `;
        
        playersList.appendChild(playerItem);
    });
}

function showStatusMessage(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} show`;
    
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 3000);
}

function showFlashMessage(message) {
    // Create flash overlay if it doesn't exist
    let flashOverlay = document.getElementById('flash-overlay');
    if (!flashOverlay) {
        flashOverlay = document.createElement('div');
        flashOverlay.id = 'flash-overlay';
        flashOverlay.className = 'flash-overlay';
        document.body.appendChild(flashOverlay);
    }
    
    // Set message and show
    flashOverlay.textContent = message;
    flashOverlay.classList.add('show');
    
    // Hide after 2 seconds
    setTimeout(() => {
        flashOverlay.classList.remove('show');
    }, 2000);
}

// Check if all tiles are placed and update submit button
function updateSubmitButtonState() {
    const currentPlayer = getCurrentPlayer();
    const handTilesCount = currentPlayer?.hand?.length || 0;
    const placedTilesCount = placedTiles.size;
    
    // Disable if game is finished
    if (gameState?.status === 'finished') {
        submitBoardBtn.disabled = true;
        submitBoardBtn.textContent = 'Game Finished';
        submitBoardBtn.classList.add('btn-disabled');
        return;
    }
    
    // Enable submit button only if all tiles are on the board (hand is empty)
    const allTilesPlaced = handTilesCount === 0 && placedTilesCount > 0;
    
    submitBoardBtn.disabled = !allTilesPlaced;
    
    if (allTilesPlaced) {
        submitBoardBtn.textContent = 'Submit Board';
        submitBoardBtn.classList.remove('btn-disabled');
    } else {
        submitBoardBtn.textContent = `Submit (${handTilesCount} tiles left)`;
        submitBoardBtn.classList.add('btn-disabled');
    }
    
    console.log(`Submit button state: ${allTilesPlaced ? 'enabled' : 'disabled'} (hand: ${handTilesCount}, board: ${placedTilesCount})`);
}

// Game-specific functions
function initializeGameBoard() {
    generateBoardGrid();
    updateBoardView();
    updateHandDisplay();
    updateSubmitButtonState();
}

function generateBoardGrid() {
    gameBoard.innerHTML = '';
    console.log(`generateBoardGrid: placedTiles.size = ${placedTiles.size}`);
    console.log('placedTiles contents:', Array.from(placedTiles.entries()));
    
    // Generate 20x20 grid tiles
    for (let row = 0; row < 20; row++) {
        for (let col = 0; col < 20; col++) {
            const tile = document.createElement('div');
            tile.className = 'grid-tile';
            
            // Calculate actual coordinates based on view position
            const actualX = col - 10 + viewPosition.x;
            const actualY = row - 10 + viewPosition.y;
            const coordKey = `${actualX},${actualY}`;
            
            tile.setAttribute('data-coord', coordKey);
            tile.setAttribute('data-x', actualX);
            tile.setAttribute('data-y', actualY);
            
            // Check if there's a placed tile at this position
            const placedTile = placedTiles.get(coordKey);
            if (placedTile) {
                console.log(`Found placed tile at ${coordKey}: ${placedTile.letter}`);
                tile.classList.add('has-tile');
                tile.innerHTML = `<span class="tile-letter">${placedTile.letter}</span>`;
                tile.setAttribute('draggable', 'true');
                tile.setAttribute('data-board-coord', coordKey);
                tile.addEventListener('contextmenu', (e) => handleTileRightClick(e, actualX, actualY));
                tile.addEventListener('dragstart', (e) => handleBoardTileDragStart(e, actualX, actualY));
                tile.addEventListener('dragend', handleBoardTileDragEnd);
                tile.addEventListener('dblclick', (e) => handleTileDoubleClick(e, actualX, actualY));
                tile.addEventListener('click', (e) => handleBoardTileClick(e, actualX, actualY));
            } else {
                // Mark the start tile (0,0)
                if (actualX === 0 && actualY === 0) {
                    tile.classList.add('start-tile');
                }
                
                // Add event handlers for empty tiles
                tile.addEventListener('click', (e) => handleGridTileClick(e, actualX, actualY));
                tile.addEventListener('dragover', handleTileDragOver);
                tile.addEventListener('drop', (e) => handleTileDrop(e, actualX, actualY));
            }
            
            gameBoard.appendChild(tile);
        }
    }
}

function updateBoardView() {
    viewXSpan.textContent = viewPosition.x;
    viewYSpan.textContent = viewPosition.y;
    generateBoardGrid();
    updateSubmitButtonState();
    
    // Update board tile counter
    if (boardTileCount) {
        boardTileCount.textContent = placedTiles.size;
    }
}

function updateTileCounters() {
    // Update remaining tiles counter
    if (remainingTilesCount && gameState?.allTiles) {
        // Count tiles that are still in the pool (not in any player's hand or on any board)
        let remainingTiles = 0;
        gameState.allTiles.forEach(tile => {
            if (tile.state === 'pool') {
                remainingTiles++;
            }
        });
        remainingTilesCount.textContent = remainingTiles;
    }
}

function scrollBoard(direction, amount = 1) {
    socket.emit('game-action', {
        tableId: currentTable.id,
        action: 'move-board',
        direction: direction,
        amount: amount
    });
}



function syncHandDisplay() {
    // Use helper function to safely get current player
    const currentPlayer = getCurrentPlayer();
    console.log('syncHandDisplay called - currentPlayer:', currentPlayer);
    console.log('currentUsername:', currentUsername);
    console.log('gameState.players:', gameState?.players);
    
    if (!currentPlayer) {
        console.log('ERROR: Current player not found in game state');
        return;
    }
    
    // Trust the server's hand state completely - no filtering needed
    // The server is the authoritative source for what tiles are in the hand
    const handTiles = [...(currentPlayer.hand || [])];
    console.log('Raw hand tiles from server:', handTiles);
    
    // Sort tiles alphabetically for display - with safety checks
    handTiles.sort((a, b) => {
        const letterA = a?.letter || '';
        const letterB = b?.letter || '';
        return letterA.localeCompare(letterB);
    });
    
    // Update the displayed hand to match server state
    currentPlayer.hand = handTiles;
    
    updateHandDisplay();
    updateSubmitButtonState();
    
    console.log(`Hand synchronized from server: ${handTiles.length} tiles (${handTiles.map(t => `${t.id}(${t.letter})`).join(', ')})`);
}

function syncBoardDisplay() {
    if (!gameState) return;
    
    console.log('=== SYNC BOARD DISPLAY DEBUG ===');
    console.log('gameState.allTiles:', gameState.allTiles);
    
    // Also check the current player's board.tiles
    const currentPlayer = getCurrentPlayer();
    console.log('currentPlayer:', currentPlayer);
    console.log('currentPlayer.board:', currentPlayer?.board);
    console.log('currentPlayer.board.tiles:', currentPlayer?.board?.tiles);
    
    // Clear current board state
    console.log(`DEBUG: Clearing placedTiles (was ${placedTiles.size} tiles)`);
    placedTiles.clear();
    
    // Determine which tile source to use
    let allTilesEntries = null;
    
    if (gameState.allTiles) {
        console.log('Using gameState.allTiles');
        // Handle both Map (if converted) and Object (JSON serialized) formats
        if (gameState.allTiles instanceof Map) {
            allTilesEntries = gameState.allTiles.entries();
        } else if (typeof gameState.allTiles === 'object') {
            // Convert object to entries array
            allTilesEntries = Object.entries(gameState.allTiles);
        } else {
            console.error('allTiles is not in expected format:', gameState.allTiles);
        }
    } else if (currentPlayer?.board?.tiles) {
        // Fallback to player-specific board tiles
        console.log('Using player.board.tiles as fallback');
        allTilesEntries = Object.entries(currentPlayer.board.tiles);
    } else {
        console.log('No tile data found in allTiles or player.board.tiles');
        return;
    }
    
    if (!allTilesEntries) {
        console.log('Could not get tile entries');
        return;
    }
    
    // Load only tiles that belong to this player's board
    let myTilesCount = 0;
    let totalTilesCount = 0;
    
    for (const [tileId, tile] of allTilesEntries) {
        totalTilesCount++;
        console.log(`Checking tile ${tileId}:`, {
            state: tile.state,
            boardOwner: tile.boardOwner,
            currentUsername: currentUsername,
            position: tile.position,
            letter: tile.letter
        });
        
        if (tile.state === 'board' && tile.boardOwner === currentUsername && tile.position) {
            myTilesCount++;
            const coordKey = `${tile.position.x},${tile.position.y}`;
            console.log(`Adding my tile ${tile.id}(${tile.letter}) at ${coordKey}`);
            console.log(`DEBUG: Setting placedTiles[${coordKey}] = ${tile.letter}`);
            placedTiles.set(coordKey, {
                id: tile.id,
                letter: tile.letter,
                fromHand: true,
                temporary: tile.temporary || true
            });
        }
    }
    
    console.log(`Processed ${totalTilesCount} total tiles, found ${myTilesCount} belonging to me`);
    console.log(`Current username: "${currentUsername}"`);
    console.log(`placedTiles after sync: ${placedTiles.size} tiles`);
    
    // Update the board view to reflect the loaded tiles
    updateBoardView();
    
    console.log(`Board synchronized from server: ${placedTiles.size} tiles on my board`);
}

function updateHandDisplay() {
    const currentPlayer = getCurrentPlayer();
    const hand = currentPlayer?.hand || [];
    
    handCount.textContent = hand.length;
    
    if (hand.length === 0) {
        playerHand.innerHTML = `
            <div class="empty-hand">
                <p>No tiles yet</p>
                <p class="hint">Tiles will appear here when the game provides them</p>
            </div>
        `;
    } else {
        playerHand.innerHTML = '';
        hand.forEach((tile, index) => {
            const tileElement = document.createElement('div');
            tileElement.className = 'tile';
            tileElement.innerHTML = `<span class="tile-letter">${tile.letter}</span>`;
            tileElement.setAttribute('data-index', index);
            tileElement.setAttribute('data-tile-id', tile.id);
            tileElement.setAttribute('draggable', 'true');
            
            // Add event listeners based on placement mode
            tileElement.addEventListener('click', () => handleTileClick(index));
            tileElement.addEventListener('dragstart', handleTileDragStart);
            tileElement.addEventListener('dragend', handleTileDragEnd);
            
            playerHand.appendChild(tileElement);
        });
    }
}

function selectTile(index) {
    // Remove previous selection
    document.querySelectorAll('.tile.selected').forEach(tile => {
        tile.classList.remove('selected');
    });
    
    // Select new tile
    const tileElement = document.querySelector(`[data-index="${index}"]`);
    if (tileElement) {
        tileElement.classList.add('selected');
        // trashTileBtn.disabled = false; // Always enabled for drag & drop
    }
}

function trashTile() {
    const selectedTile = document.querySelector('.tile.selected');
    if (selectedTile) {
        const tileId = selectedTile.getAttribute('data-tile-id');
        trashTileById(tileId);
    } else {
        showStatusMessage('💡 Drag a tile here to trash it! (Costs 1 tile, gives 3 new tiles)', 'info');
    }
}

function trashTileByIndex(tileIndex) {
    // Get the tile ID from the current hand
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer && currentPlayer.hand[tileIndex]) {
        const tileId = currentPlayer.hand[tileIndex].id;
        trashTileById(tileId);
    }
}

function trashTileById(tileId) {
    console.log('trashTileById called with tileId:', tileId);
    if (currentTable && gameState) {
        console.log('Sending trash-tile action to server for tile ID:', tileId);
        socket.emit('game-action', {
            tableId: currentTable.id,
            action: 'trash-tile',
            tileId: tileId
        });
        clearSelection();
    } else {
        console.log('Cannot trash tile - no current table or gameState');
    }
}

// Trash button drag and drop handlers
function handleTrashDragOver(e) {
    e.preventDefault();
    e.target.classList.add('drag-over-trash');
}

function handleTrashDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over-trash');
    
    const dragData = e.dataTransfer.getData('text/plain');
    console.log('Trash drop - received drag data:', dragData);
    
    // Try to parse as JSON first (new format)
    try {
        const tileData = JSON.parse(dragData);
        console.log('Parsed tile data:', tileData);
        if (tileData.type === 'board') {
            // This is a board tile, can't be trashed
            console.log('Cannot trash board tile');
            return;
        } else if (tileData.type === 'hand') {
            // This is a hand tile - trash by tile ID
            console.log('Trashing hand tile with ID:', tileData.tileId);
            trashTileById(tileData.tileId);
            return;
        }
    } catch (parseError) {
        console.log('Failed to parse as JSON, trying legacy format:', parseError);
        // Not JSON data, try as legacy simple index format
        const tileIndex = parseInt(dragData);
        if (!isNaN(tileIndex)) {
            console.log('Using legacy index format:', tileIndex);
            trashTileByIndex(tileIndex);
        }
    }
}

function handleTrashDragLeave(e) {
    e.target.classList.remove('drag-over-trash');
}

// Hand drop handlers (for returning board tiles to hand)
function handleHandDragOver(e) {
    // Only allow board tiles to be dropped on hand
    const dragData = e.dataTransfer.getData('text/plain');
    try {
        const boardTileData = JSON.parse(dragData);
        if (boardTileData.type === 'board') {
            e.preventDefault();
            e.target.classList.add('drag-over-hand');
        }
    } catch (error) {
        // Not a board tile, don't allow drop
    }
}

function handleHandDrop(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over-hand');
    
    // Play drop sound
    gameSounds.playTileDrop();
    
    const dragData = e.dataTransfer.getData('text/plain');
    try {
        const boardTileData = JSON.parse(dragData);
        if (boardTileData.type === 'board') {
            // Remove tile from board locally
            placedTiles.delete(boardTileData.coordKey);
            
            // Notify server about tile return
            socket.emit('game-action', {
                tableId: currentTable.id,
                action: 'return-tile-to-hand',
                tileId: boardTileData.tile.id,
                x: boardTileData.x,
                y: boardTileData.y
            });
            
            // Update displays
            updateBoardView();
            // Hand will be updated when server responds with game state
            
            showStatusMessage(`Returned ${boardTileData.tile.letter} to hand`, 'success');
        }
    } catch (error) {
        showStatusMessage('Invalid drop target', 'error');
    }
}

function handleHandDragLeave(e) {
    e.target.classList.remove('drag-over-hand');
}

function handleTileDoubleClick(e, x, y) {
    e.preventDefault();
    
    // Find the tile at this position
    const coordKey = `${x},${y}`;
    const tileData = placedTiles.get(coordKey);
    
    if (!tileData) {
        return; // No tile at this position
    }
    
    // Play drop sound (same as drag to hand)
    gameSounds.playTileDrop();
    
    // Remove tile from board locally
    placedTiles.delete(coordKey);
    
    // Notify server about tile return (same code path as drag to hand)
    socket.emit('game-action', {
        tableId: currentTable.id,
        action: 'return-tile-to-hand',
        tileId: tileData.id,
        x: x,
        y: y
    });
    
    // Update displays
    updateBoardView();
    // Hand will be updated when server responds with game state
    
    showStatusMessage(`Returned ${tileData.letter} to hand`, 'success');
}

function resignGame() {
    if (confirm('Are you sure you want to resign? You will lose the game.')) {
        socket.emit('resign-game', currentTable.id);
        showScreen('lobby');
        resetGameState();
    }
}

function startGameTimer() {
    gameTimerInterval = setInterval(() => {
        if (gameStartTime) {
            const now = new Date();
            const elapsed = Math.floor((now - gameStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            gameTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function stopGameTimer() {
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
}

function resetGameState() {
    gameState = null;
    playerBoard = null;
    viewPosition = { x: 0, y: 0 };
    gameStartTime = null;
    stopGameTimer();
    // playerScore.textContent = '0'; // Removed - score element no longer exists
    gameTimer.textContent = '00:00';
    // trashTileBtn.disabled = true; // Keep trash button enabled for drag & drop
    hideWaitingOverlay();
    hideCountdownOverlay();
    
    // Reset tile placement state
    placedTiles.clear();
    selectedHandTile = null;
    typingPosition = null;
    typingDirection = null;
    hideDirectionArrows();
}

function showWaitingOverlay() {
    waitingOverlay.style.display = 'flex';
    
    // Show appropriate button based on host status
    if (isHost) {
        startGameplayBtn.style.display = 'block';
        waitingForHostBtn.style.display = 'none';
    } else {
        startGameplayBtn.style.display = 'none';
        waitingForHostBtn.style.display = 'block';
    }
}

function hideWaitingOverlay() {
    waitingOverlay.style.display = 'none';
}

function showCountdownOverlay() {
    countdownOverlay.style.display = 'flex';
}

function hideCountdownOverlay() {
    countdownOverlay.style.display = 'none';
}

function startGameplay() {
    if (currentTable && isHost) {
        socket.emit('start-gameplay', currentTable.id);
    }
}

// Tile placement functions
function exitTypingMode() {
    hideDirectionArrows();
    clearNextActiveTileHighlight();
    typingPosition = null;
    typingDirection = null;
}

function handleTileClick(index) {
    selectTile(index);
}

function selectTile(index) {
    // Immediately fade direction arrows and exit typing mode
    hideDirectionArrows();
    exitTypingMode();
    
    // Remove previous selection
    document.querySelectorAll('.tile.selected').forEach(tile => {
        tile.classList.remove('selected');
    });
    
    // Select new tile
    const tileElement = document.querySelector(`[data-index="${index}"]`);
    if (tileElement) {
        tileElement.classList.add('selected');
        selectedHandTile = index;
        // trashTileBtn.disabled = false; // Always enabled for drag & drop
        
        showStatusMessage('Click an empty board tile to place, or drag to desired position', 'info');
    }
}

function handleGridTileClick(e, x, y) {
    // Immediately fade direction arrows when tapping anywhere
    hideDirectionArrows();
    exitTypingMode();
    
    const coordKey = `${x},${y}`;
    
    // Check if there's already a tile at this position
    if (placedTiles.has(coordKey)) {
        return; // Don't place on occupied spaces
    }
    
    if (selectedHandTile !== null) {
        // Place tile from hand
        const currentPlayer = getCurrentPlayer();
        const tile = currentPlayer?.hand[selectedHandTile];
        
        if (tile) {
            console.log(`Click-placing tile from hand: ${tile.id} (${tile.letter}) at ${x},${y}`);
            
            // Place the tile locally for immediate visual feedback
            console.log(`DEBUG: 2-click placing tile ${tile.letter} at ${coordKey}`);
            placedTiles.set(coordKey, { ...tile, fromHand: true, temporary: true });
            console.log(`DEBUG: placedTiles.size after 2-click placement: ${placedTiles.size}`);
            
            // Remove from hand locally (server will update authoritative state)
            currentPlayer.hand.splice(selectedHandTile, 1);
            
            // Notify server about tile placement
            socket.emit('game-action', {
                tableId: currentTable.id,
                action: 'place-tile',
                tileId: tile.id,
                tileIndex: selectedHandTile,
                x: x,
                y: y
            });
            
            // Show direction arrows
            showDirectionArrows(x, y);
            typingPosition = { x, y };
            
            // Update displays
            updateBoardView();
            syncHandDisplay();
            clearSelection();
        }
    } else if (selectedBoardTile !== null) {
        // Move tile from board to new position
        console.log(`Click-moving tile from board: ${selectedBoardTile.tileData.letter} from ${selectedBoardTile.x},${selectedBoardTile.y} to ${x},${y}`);
        
        // Remove tile from old position locally
        const oldCoordKey = `${selectedBoardTile.x},${selectedBoardTile.y}`;
        placedTiles.delete(oldCoordKey);
        
        // Place tile at new position locally
        placedTiles.set(coordKey, { ...selectedBoardTile.tileData });
        
        // Notify server about tile movement
        socket.emit('game-action', {
            tableId: currentTable.id,
            action: 'move-tile-on-board',
            tileId: selectedBoardTile.tileData.id,
            fromX: selectedBoardTile.x,
            fromY: selectedBoardTile.y,
            toX: x,
            toY: y
        });
        
        // Show direction arrows at new position
        showDirectionArrows(x, y);
        typingPosition = { x, y };
        
        // Update displays
        updateBoardView();
        clearSelection();
        
        showStatusMessage(`Moved ${selectedBoardTile.tileData.letter} to new position`, 'success');
    }
}

function showDirectionArrows(x, y) {
    const gridTile = document.querySelector(`[data-coord="${x},${y}"]`);
    if (!gridTile) return;
    
    const rect = gridTile.getBoundingClientRect();
    const boardRect = gameBoard.getBoundingClientRect();
    
    // Calculate position relative to the board
    const relativeX = rect.left - boardRect.left + 20; // Center on tile
    const relativeY = rect.top - boardRect.top + 20;   // Center on tile
    
    directionArrows.style.display = 'block';
    directionArrows.style.left = relativeX + 'px';
    directionArrows.style.top = relativeY + 'px';
    
    // Check for tile collisions and adjust arrow positions if needed
    adjustArrowPositions(x, y, relativeX, relativeY);
    
    // Set default direction to right and auto-select it
    typingDirection = 'right';
    document.querySelectorAll('.dir-arrow').forEach(arrow => {
        arrow.classList.toggle('selected', arrow.dataset.direction === 'right');
    });
    
    // Highlight next active tile
    highlightNextActiveTile();
    
    // Add click handlers to direction arrows
    document.querySelectorAll('.dir-arrow').forEach(arrow => {
        arrow.addEventListener('click', (e) => handleDirectionSelect(e.target.dataset.direction));
    });
    
    // Clear any existing timer and set auto-fade after 3 seconds
    if (directionArrowTimer) {
        clearTimeout(directionArrowTimer);
    }
    
    directionArrowTimer = setTimeout(() => {
        hideDirectionArrows();
        exitTypingMode();
    }, 3000);
}

function adjustArrowPositions(centerX, centerY, relativeX, relativeY) {
    const arrows = {
        down: { x: centerX, y: centerY + 1, element: document.querySelector('.dir-down') },
        right: { x: centerX + 1, y: centerY, element: document.querySelector('.dir-right') }
    };
    
    // Check each arrow position and adjust if there's a tile there
    Object.entries(arrows).forEach(([direction, arrow]) => {
        if (!arrow.element) return; // Skip if element doesn't exist
        
        const coordKey = `${arrow.x},${arrow.y}`;
        const hasTile = placedTiles.has(coordKey);
        
        if (hasTile) {
            // Move arrow further away if there's a tile collision
            switch(direction) {
                case 'down':
                    arrow.element.style.bottom = '-60px';
                    break;
                case 'right':
                    arrow.element.style.right = '-60px';
                    break;
            }
        } else {
            // Reset to default position
            switch(direction) {
                case 'down':
                    arrow.element.style.bottom = '-50px';
                    break;
                case 'right':
                    arrow.element.style.right = '-50px';
                    break;
            }
        }
    });
}

function hideDirectionArrows() {
    directionArrows.style.display = 'none';
    document.querySelectorAll('.dir-arrow.selected').forEach(arrow => {
        arrow.classList.remove('selected');
    });
    
    // Clear the auto-fade timer
    if (directionArrowTimer) {
        clearTimeout(directionArrowTimer);
        directionArrowTimer = null;
    }
}

function handleDirectionSelect(direction) {
    typingDirection = direction;
    
    // Highlight selected direction
    document.querySelectorAll('.dir-arrow').forEach(arrow => {
        arrow.classList.toggle('selected', arrow.dataset.direction === direction);
    });
    
    // Update next active tile highlight
    highlightNextActiveTile();
    
    // Reset the auto-fade timer when user manually interacts with arrows
    if (directionArrowTimer) {
        clearTimeout(directionArrowTimer);
        directionArrowTimer = setTimeout(() => {
            hideDirectionArrows();
            exitTypingMode();
        }, 3000);
    }
    
    showStatusMessage(`Direction set to ${direction}. Type letters to place tiles!`, 'success');
    
    // Focus on the window to capture keyboard input
    window.focus();
}

function handleKeyboardInput(e) {
    // Handle arrow keys for board scrolling (when not in typing mode)
    if (!typingPosition && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        
        let direction;
        switch (e.key) {
            case 'ArrowUp':
                direction = 'up';
                break;
            case 'ArrowDown':
                direction = 'down';
                break;
            case 'ArrowLeft':
                direction = 'left';
                break;
            case 'ArrowRight':
                direction = 'right';
                break;
        }
        
        // Scroll board by 2 tiles at a time
        scrollBoard(direction, 2);
        return;
    }

    if (typingPosition && typingDirection) {
        const letter = e.key.toUpperCase();
        
        // Check if it's a valid letter
        if (/^[A-Z]$/.test(letter)) {
            e.preventDefault();
            
            // Find if player has this letter
            const currentPlayer = getCurrentPlayer();
            const tileIndex = currentPlayer?.hand.findIndex(tile => tile.letter === letter);
            
            if (tileIndex !== -1) {
                // Place the tile in the specified direction
                placeTileInDirection(letter, tileIndex);
            } else {
                showStatusMessage(`You don't have the letter ${letter}`, 'error');
            }
        } else if (e.key === 'Escape') {
            // Exit typing mode
            exitTypingMode();
        }
    }
}

function placeTileInDirection(letter, tileIndex) {
    const currentPlayer = getCurrentPlayer();
    const tile = currentPlayer.hand[tileIndex];
    
    // Find next empty position in the specified direction
    const nextPosition = findNextEmptyPosition(typingPosition.x, typingPosition.y, typingDirection);
    
    if (!nextPosition) {
        showStatusMessage('No more empty positions in this direction!', 'error');
        return;
    }
    
    const coordKey = `${nextPosition.x},${nextPosition.y}`;
    
    console.log(`Placing tile ${tile.id} (${tile.letter}) at ${nextPosition.x},${nextPosition.y}`);
    
    // Place the tile locally for immediate visual feedback
    placedTiles.set(coordKey, { ...tile, fromHand: true, temporary: true });
    
    // Notify server about tile placement (server will update the authoritative hand state)
    socket.emit('game-action', {
        tableId: currentTable.id,
        action: 'place-tile',
        tileId: tile.id,
        tileIndex: tileIndex,
        x: nextPosition.x,
        y: nextPosition.y
    });
    
    // Update typing position
    typingPosition = { x: nextPosition.x, y: nextPosition.y };
    
    // Update board view (hand will be updated when server confirms)
    console.log(`After placing tile ${tile.id}(${tile.letter}), placedTiles.size = ${placedTiles.size}`);
    console.log('placedTiles contents:', Array.from(placedTiles.entries()));
    updateBoardView();
    
    // Highlight next active tile
    highlightNextActiveTile();
    
    showStatusMessage(`Placed ${letter}. Continue typing or press ESC to finish.`, 'success');
}

function findNextEmptyPosition(startX, startY, direction) {
    let x = startX;
    let y = startY;
    const maxDistance = 20; // Prevent infinite searching
    
    // Move in the specified direction until we find an empty spot or reach limit
    for (let i = 0; i < maxDistance; i++) {
        switch (direction) {
            case 'down': y++; break;
            case 'right': x++; break;
            default: x++; break; // Default to right
        }
        
        const coordKey = `${x},${y}`;
        if (!placedTiles.has(coordKey)) {
            return { x, y };
        }
    }
    
    return null; // No empty position found within reasonable distance
}

function highlightNextActiveTile() {
    // Clear previous highlight
    clearNextActiveTileHighlight();
    
    if (!typingPosition || !typingDirection) return;
    
    // Find next empty position
    const nextPosition = findNextEmptyPosition(typingPosition.x, typingPosition.y, typingDirection);
    
    if (nextPosition) {
        const gridTile = document.querySelector(`[data-coord="${nextPosition.x},${nextPosition.y}"]`);
        if (gridTile) {
            gridTile.classList.add('next-active');
        }
    }
}

function clearNextActiveTileHighlight() {
    document.querySelectorAll('.grid-tile.next-active').forEach(tile => {
        tile.classList.remove('next-active');
    });
}

// Drag and Drop functions
function handleTileDragStart(e) {
    // Exit any active typing mode when dragging
    exitTypingMode();
    
    // Play drag start sound
    gameSounds.playTileDragStart();
    
    e.target.classList.add('dragging');
    // Set both index and tile ID for compatibility
    const dragData = {
        type: 'hand',
        index: parseInt(e.target.dataset.index),
        tileId: e.target.dataset.tileId
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
}

function handleTileDragEnd(e) {
    e.target.classList.remove('dragging');
}

// Board tile drag handlers
function handleBoardTileDragStart(e, x, y) {
    exitTypingMode(); // Exit any active typing mode
    
    // Play drag start sound
    gameSounds.playTileDragStart();
    
    e.target.classList.add('dragging');
    const coordKey = `${x},${y}`;
    const tileData = {
        type: 'board',
        x: x,
        y: y,
        coordKey: coordKey,
        tile: placedTiles.get(coordKey)
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(tileData));
}

function handleBoardTileDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleTileDragOver(e) {
    e.preventDefault();
    e.target.classList.add('preview-drop');
}

// Add drag leave to clean up preview
document.addEventListener('dragleave', (e) => {
    if (e.target.classList.contains('grid-tile')) {
        e.target.classList.remove('preview-drop');
    }
});

function handleTileDrop(e, x, y) {
    e.preventDefault();
    e.target.classList.remove('preview-drop');
    
    // Play drop sound
    gameSounds.playTileDrop();
    
    const dragData = e.dataTransfer.getData('text/plain');
    let tileSource, tile, originalData;
    
    // Try to parse as JSON data first
    try {
        const tileData = JSON.parse(dragData);
        if (tileData.type === 'board') {
            tileSource = 'board';
            tile = tileData.tile;
            originalData = tileData;
            // Remove tile from its original board position
            placedTiles.delete(tileData.coordKey);
        } else if (tileData.type === 'hand') {
            tileSource = 'hand';
            const currentPlayer = getCurrentPlayer();
            tile = currentPlayer?.hand[tileData.index];
            originalData = { tileIndex: tileData.index, currentPlayer };
        } else {
            throw new Error('Unknown tile type');
        }
    } catch (parseError) {
        // Legacy format: simple index for hand tiles
        tileSource = 'hand';
        const tileIndex = parseInt(dragData);
        const currentPlayer = getCurrentPlayer();
        tile = currentPlayer?.hand[tileIndex];
        originalData = { tileIndex, currentPlayer };
    }
    
    if (tile) {
        const coordKey = `${x},${y}`;
        
        // Check if position is empty
        if (!placedTiles.has(coordKey)) {
            // Place the tile locally for immediate visual feedback
            console.log(`DEBUG: Drag-drop placing tile ${tile.letter} at ${coordKey}`);
            placedTiles.set(coordKey, { ...tile, fromHand: true, temporary: true });
            console.log(`DEBUG: placedTiles.size after drag-drop placement: ${placedTiles.size}`);
            console.log(`Placed tile ${tile.id}(${tile.letter}) at ${coordKey}, placedTiles.size = ${placedTiles.size}`);
            
            // Notify server about tile movement (all movements go through server now)
            if (tileSource === 'hand') {
                console.log(`Drag-placing tile from hand: ${tile.id} (${tile.letter}) at ${x},${y}`);
                socket.emit('game-action', {
                    tableId: currentTable.id,
                    action: 'place-tile',
                    tileId: tile.id,
                    tileIndex: originalData.tileIndex,
                    x: x,
                    y: y
                });
            } else if (tileSource === 'board') {
                console.log(`Drag-moving tile on board: ${tile.id} (${tile.letter}) from ${originalData.x},${originalData.y} to ${x},${y}`);
                socket.emit('game-action', {
                    tableId: currentTable.id,
                    action: 'move-tile-on-board',
                    tileId: tile.id,
                    fromX: originalData.x,
                    fromY: originalData.y,
                    toX: x,
                    toY: y
                });
            }
            
            // Show direction arrows for continuing placement
            showDirectionArrows(x, y);
            typingPosition = { x, y };
            
    // Update displays
    updateBoardView();
    syncHandDisplay();
    updateSubmitButtonState();            showStatusMessage(`Moved ${tile.letter} - use arrows to continue or click another tile`, 'success');
        } else {
            showStatusMessage('Position already occupied!', 'error');
            // If move failed, restore tile to original position
            if (tileSource === 'board') {
                placedTiles.set(originalData.coordKey, tile);
            }
            // Note: For hand tiles, we don't need to restore since we never removed them
            updateBoardView();
            syncHandDisplay();
        }
    }
}

function handleBoardTileClick(e, x, y) {
    e.preventDefault();
    
    // Immediately fade direction arrows when tapping any tile
    hideDirectionArrows();
    exitTypingMode();
    
    const coordKey = `${x},${y}`;
    const tileData = placedTiles.get(coordKey);
    
    if (!tileData) return;
    
    // Clear any existing selection first
    clearSelection();
    
    // Select this board tile
    selectedBoardTile = { x, y, tileData };
    e.target.classList.add('selected');
    
    showStatusMessage(`Selected ${tileData.letter} tile. Tap empty space to move it there.`, 'info');
}

function handleTileRightClick(e, x, y) {
    e.preventDefault();
    
    const coordKey = `${x},${y}`;
    const placedTile = placedTiles.get(coordKey);
    
    if (placedTile && placedTile.fromHand && placedTile.temporary) {
        console.log(`Right-click returning tile ${placedTile.id} (${placedTile.letter}) to hand`);
        
        // Play whoosh sound for returning to hand
        gameSounds.playWhoosh();
        
        // Optimistically update client for immediate visual feedback
        const currentPlayer = getCurrentPlayer();
        currentPlayer.hand.push({ 
            id: placedTile.id, 
            letter: placedTile.letter 
        });
        
        // Remove from board locally
        placedTiles.delete(coordKey);
        
        // Notify server about tile return to hand
        socket.emit('game-action', {
            tableId: currentTable.id,
            action: 'return-tile-to-hand',
            tileId: placedTile.id,
            x: x,
            y: y
        });
        
        // Update displays
        updateBoardView();
        updateHandDisplay();
        
        showStatusMessage(`Returned ${placedTile.letter} to hand`, 'info');
    }
}

function clearSelection() {
    selectedHandTile = null;
    selectedBoardTile = null;
    document.querySelectorAll('.tile.selected, .grid-tile.selected').forEach(tile => {
        tile.classList.remove('selected');
    });
    // trashTileBtn.disabled = true; // Keep enabled for drag & drop functionality
}

function submitBoard() {
    // Check if game is finished
    if (gameState?.status === 'finished') {
        showStatusMessage('Game is finished!', 'error');
        return;
    }
    
    // Check if submit is allowed
    const currentPlayer = getCurrentPlayer();
    const handTilesCount = currentPlayer?.hand?.length || 0;
    const placedCount = placedTiles.size;
    
    if (handTilesCount > 0) {
        showStatusMessage(`You must place all ${handTilesCount} remaining tiles before submitting!`, 'error');
        return;
    }
    
    if (placedCount === 0) {
        showStatusMessage('No tiles placed on board!', 'error');
        return;
    }
    
    // Prepare all placed tiles data to send to server
    const boardData = [];
    placedTiles.forEach((tile, coordKey) => {
        const [x, y] = coordKey.split(',').map(Number);
        boardData.push({
            tileId: tile.id,
            letter: tile.letter,
            row: y,  // y coordinate becomes row
            col: x   // x coordinate becomes col
        });
    });
    
    if (boardData.length === 0) {
        showStatusMessage('No tiles on board to submit!', 'error');
        return;
    }
    
    console.log('Submitting board with tiles:', boardData);
    console.log('DEBUG: placedTiles map contents:');
    placedTiles.forEach((tile, coordKey) => {
        console.log(`  ${coordKey}: ${tile.letter} (id: ${tile.id})`);
    });
    
    // Send submission to server
    socket.emit('game-action', {
        tableId: currentTable.id,
        action: 'submit-board',
        boardData: boardData
    });
    
    // Hide direction arrows and clear typing state
    hideDirectionArrows();
    typingPosition = null;
    typingDirection = null;
    
    showStatusMessage(`Submitting ${boardData.length} tiles for validation...`, 'info');
}

// Debug functions for manual refresh
function refreshHand() {
    console.log('=== MANUAL HAND REFRESH TRIGGERED ===');
    console.log('Manual refresh: requesting current hand from server');
    socket.emit('requestHandUpdate');
    
    // Visual feedback
    const refreshBtn = document.getElementById('refresh-hand-btn');
    if (refreshBtn) {
        refreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            refreshBtn.style.transform = 'rotate(0deg)';
        }, 600);
    } else {
        console.error('Refresh hand button not found!');
    }
}

function refreshBoard() {
    console.log('=== MANUAL BOARD REFRESH TRIGGERED ===');
    console.log('Manual refresh: requesting current board from server');
    socket.emit('requestBoardUpdate');
    
    // Visual feedback
    const refreshBtn = document.getElementById('refresh-board-btn');
    if (refreshBtn) {
        refreshBtn.style.transform = 'rotate(360deg)';
        setTimeout(() => {
            refreshBtn.style.transform = 'rotate(0deg)';
        }, 600);
    } else {
        console.error('Refresh board button not found!');
    }
}

// Game Over Functions
function showGameOverModal(gameOverData) {
    console.log('showGameOverModal called with:', gameOverData);
    const { winner, playerStats: playerStatsData, message } = gameOverData;
    
    // Play appropriate game over sound
    const currentPlayer = getCurrentPlayer();
    if (currentPlayer && currentPlayer.username === winner) {
        // Current user won - play fanfare
        gameSounds.playWinFanfare();
    } else {
        // Current user lost - play sad trombone
        gameSounds.playLoseTrombone();
    }
    
    // Update modal content
    gameOverTitle.textContent = '🎉 Game Over! 🎉';
    gameOverMessage.textContent = message;
    
    // Generate player statistics HTML
    const statsHTML = playerStatsData.map(player => {
        const isWinner = player.isWinner;
        const scoreBreakdown = player.scoreBreakdown || {};
        
        return `
            <div class="player-stat ${isWinner ? 'winner' : ''}">
                <div class="player-name">
                    ${player.username}${isWinner ? ' 👑' : ''}
                </div>
                <div class="score-display">
                    <div class="total-score">Score: ${player.score || 0}</div>
                    ${scoreBreakdown.tileScore !== undefined ? `
                        <div class="score-breakdown">
                            Tile Points: ${scoreBreakdown.tileScore} | Length Bonus: ${scoreBreakdown.lengthBonus} | Valid Words: ${scoreBreakdown.validWordCount}
                        </div>
                    ` : ''}
                </div>
                <div class="stat-grid">
                    <div class="stat-item">
                        <div class="stat-label">Tiles on Board</div>
                        <div class="stat-value">${player.tilesOnBoard}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Tiles in Hand</div>
                        <div class="stat-value">${player.tilesInHand}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Tiles Trashed</div>
                        <div class="stat-value">${player.tilesTrashCount}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Valid Submissions</div>
                        <div class="stat-value">${player.validSubmissions}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    playerStats.innerHTML = statsHTML;
    
    // Show the modal
    console.log('About to show modal. gameOverModal element:', gameOverModal);
    if (gameOverModal) {
        gameOverModal.classList.add('active');
        gameOverModal.style.display = 'flex'; // Override inline display: none
        console.log('Modal classes after adding active:', gameOverModal.classList.toString());
        console.log('Modal display style set to:', gameOverModal.style.display);
    } else {
        console.error('gameOverModal element not found!');
    }
    
    console.log('Game over modal displayed');
}

function returnToLobbyFromGameOver() {
    // Hide the modal
    gameOverModal.classList.remove('active');
    gameOverModal.style.display = 'none'; // Explicitly hide modal
    
    // Reset game state
    currentTable = null;
    gameState = null;
    placedTiles.clear();
    
    // Clear game timer if running
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
    
    // Return to lobby screen
    showScreen('lobby');
    
    console.log('Returned to lobby from game over');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    showScreen('username');
    usernameInput.focus();
});