# SpeedWurdz 🎯

A fast-paced multiplayer word game similar to Bananagrams, built with Node.js and Socket.io.

## 🚀 Live Demo
[Coming Soon - Alpha Testing]

## 🎮 How to Play
1. Join a lobby with your username
2. Create or join a game table (2-6 players)
3. When the game starts, use your letter tiles to build connected words
4. First player to use all their tiles wins!
5. Points awarded based on Scrabble tile values + length bonuses

## ✨ Features
- **Real-time multiplayer** - Up to 6 players per game
- **Spell checking** - 172,820 word dictionary validation  
- **Scoring system** - Scrabble-based points with bonuses
- **Sound effects** - Complete audio experience with toggle
- **Mobile responsive** - Play on any device
- **Drag & drop** - Intuitive tile placement
- **Private boards** - Each player has their own word grid

## Quick Start

### Prerequisites
- Node.js (version 14 or higher)
- npm (Node Package Manager)

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd speedwurdz
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Open your browser**
   - Navigate to `http://localhost:3000`
   - Enter a username to join the lobby
   - Create or join tables with other players

## How to Use

### Joining the Lobby
1. Enter a unique username (2-20 characters)
2. Click "Join Lobby" to enter the main lobby area
3. You'll see other active users and available game tables

### Creating a Table
1. Click "Create New Table" in the lobby
2. Enter a table name and select max players (2-4)
3. Click "Create Table" to host a new game
4. Wait for other players to join

### Joining a Table
1. Browse available tables in the lobby
2. Click "Join Table" on any table with available slots
3. Wait in the table lobby for the game to start

### Table Management
- **Host privileges**: Table creator can start the game when ready
- **Player management**: See all players in your table
- **Leave anytime**: Exit tables or lobby at any point

## Technical Details

### Architecture
- **Backend**: Node.js with Express web server
- **Real-time Communication**: Socket.io for bidirectional client-server communication
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **State Management**: In-memory storage for users and tables

### Project Structure
```
speedwurdz/
├── server.js              # Main server file with Socket.io logic
├── package.json           # Node.js dependencies and scripts
├── public/                # Static web files
│   ├── index.html        # Main HTML page
│   ├── styles.css        # CSS styling
│   └── app.js            # Client-side JavaScript
├── .github/
│   └── copilot-instructions.md  # Development guidelines
└── README.md             # This file
```

### Socket.io Events

#### Client → Server
- `join-lobby`: Join the game lobby with username
- `create-table`: Create a new game table
- `join-table`: Join an existing table
- `leave-table`: Leave current table

#### Server → Client
- `lobby-joined`: Confirmation of lobby entry with initial data
- `user-joined`/`user-left`: User presence updates
- `table-created`/`table-updated`/`table-deleted`: Table state changes
- `player-joined`/`player-left`: Table player updates
- `error`: Error messages for invalid actions

## Development

### Running in Development Mode
```bash
npm run dev
```
This uses nodemon to automatically restart the server when files change.

### Adding New Features
The codebase is structured to easily add new features:

1. **Server Logic**: Add new Socket.io event handlers in `server.js`
2. **Client Logic**: Add corresponding event handlers in `public/app.js`
3. **UI Components**: Update HTML structure in `public/index.html`
4. **Styling**: Add CSS rules in `public/styles.css`

### Code Organization
- **Separation of Concerns**: Lobby logic is separate from future game logic
- **Real-time Architecture**: All state changes broadcast via Socket.io
- **Responsive Design**: Mobile-first CSS with desktop enhancements
- **Error Handling**: Comprehensive validation and user feedback

## Game Rules (Future Implementation)

SpeedWurdz will implement Bananagrams-style gameplay:
- Each player gets a set of letter tiles
- Build connected word grids using all tiles
- First player to use all tiles wins the round
- Real-time tile trading and word building
- Support for 2-4 players per game

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### Common Issues

**Server won't start**
- Check if port 3000 is already in use
- Ensure Node.js is installed correctly
- Run `npm install` to install dependencies

**Can't connect to lobby**
- Verify the server is running
- Check browser console for JavaScript errors
- Try refreshing the page

**Username already taken**
- Choose a different username
- Wait a moment and try again (previous user may be disconnecting)

### Browser Compatibility
- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## License

MIT License - Feel free to use and modify as needed.

## Version History

### v1.0.0 (Current)
- Initial lobby system implementation
- User management and presence
- Table creation and joining
- Real-time multiplayer infrastructure
- Responsive web design

### Roadmap
- v1.1.0: Basic word game mechanics
- v1.2.0: Tile management system
- v1.3.0: Scoring and win conditions
- v2.0.0: Advanced features and tournaments