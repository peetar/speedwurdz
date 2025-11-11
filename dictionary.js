const fs = require('fs');
const path = require('path');

class Dictionary {
    constructor() {
        this.words = new Set();
        this.loaded = false;
    }

    async loadDictionary() {
        if (this.loaded) {
            return;
        }

        try {
            const dictionaryPath = path.join(__dirname, 'enable1.txt');
            const content = fs.readFileSync(dictionaryPath, 'utf8');
            const words = content.split('\n').map(word => word.trim().toLowerCase()).filter(word => word.length > 0);
            
            this.words = new Set(words);
            this.loaded = true;
            
            console.log(`Dictionary loaded: ${this.words.size} words`);
        } catch (error) {
            console.error('Failed to load dictionary:', error);
            throw error;
        }
    }

    isValidWord(word) {
        if (!this.loaded) {
            throw new Error('Dictionary not loaded yet');
        }
        
        // Convert to lowercase for checking
        const normalizedWord = word.toLowerCase().trim();
        
        // Words must be at least 2 characters long
        if (normalizedWord.length < 2) {
            return false;
        }
        
        return this.words.has(normalizedWord);
    }

    getWordCount() {
        return this.words.size;
    }
}

// Export a singleton instance
const dictionary = new Dictionary();

module.exports = dictionary;