const {
  getChar,
  OPEN_BRAKET,
  CLOSE_BRAKET, EQ, TAB, SPACE, N, QUOTEMARK,
  PLACEHOLDER_SPACE, PLACEHOLDER_SPACE_TAB,
  SLASH,
} = require('./char');
const Token = require('./Token');

const createTokenOfType = (type, value, line, row) => new Token(type, value, line, row);

class Tokenizer {
  constructor(input, options = {}) {
    this.buffer = input;
    this.colPos = 0;
    this.rowPos = 0;
    this.index = 0;

    this.tokenIndex = -1;
    this.tokens = new Array(Math.floor(this.buffer.length));
    this.dummyToken = createTokenOfType('', '', '', '');

    this.wordToken = this.dummyToken;
    this.tagToken = this.dummyToken;
    this.attrNameToken = this.dummyToken;
    this.attrValueToken = this.dummyToken;
    this.attrTokens = [];

    this.options = options;
  }

  emitToken(token) {
    if (this.options.onToken) {
      this.options.onToken(token);
    }
  }

  appendToken(token) {
    this.tokenIndex += 1;
    this.tokens[this.tokenIndex] = token;
    this.emitToken(token);
  }

  nextCol() {
    this.colPos += 1;
  }

  nextLine() {
    this.rowPos += 1;
  }

  flushWord() {
    if (this.wordToken[Token.TYPE_ID] && this.wordToken[Token.VALUE_ID]) {
      this.appendToken(this.wordToken);
      this.wordToken = this.createWordToken('');
    }
  }

  createWord(value, line, row) {
    if (this.wordToken[Token.TYPE_ID] === '') {
      this.wordToken = this.createWordToken(value, line, row);
    }
  }

  flushTag() {
    if (this.tagToken[Token.TYPE_ID]) {
      // [] and [=] tag case
      if (this.tagToken[Token.VALUE_ID] === '') {
        const value = this.attrValueToken[Token.TYPE_ID] ? getChar(EQ) : '';
        const word = getChar(OPEN_BRAKET) + value + getChar(CLOSE_BRAKET);

        this.createWord('', 0, 0);
        this.wordToken[Token.VALUE_ID] += word;

        this.tagToken = this.dummyToken;

        if (this.attrValueToken[Token.TYPE_ID]) {
          this.attrValueToken = this.dummyToken;
        }

        return;
      }

      if (this.attrNameToken[Token.TYPE_ID] && !this.attrValueToken[Token.TYPE_ID]) {
        this.tagToken[Token.VALUE_ID] += PLACEHOLDER_SPACE + this.attrNameToken[Token.VALUE_ID];
        this.attrNameToken = this.dummyToken;
      }

      this.appendToken(this.tagToken);
      this.tagToken = this.dummyToken;
    }
  }

  flushUnclosedTag() {
    if (this.tagToken[Token.TYPE_ID]) {
      const value = this.tagToken[Token.VALUE_ID] + (this.attrValueToken[Token.VALUE_ID] ? getChar(EQ) : '');

      this.tagToken[Token.TYPE_ID] = Token.TYPE_WORD;
      this.tagToken[Token.VALUE_ID] = getChar(OPEN_BRAKET) + value;

      this.appendToken(this.tagToken);

      this.tagToken = this.dummyToken;

      if (this.attrValueToken[Token.TYPE_ID]) {
        this.attrValueToken = this.dummyToken;
      }
    }
  }

  flushAttrNames() {
    if (this.attrNameToken[Token.TYPE_ID]) {
      this.attrTokens.push(this.attrNameToken);
      this.attrNameToken = this.dummyToken;
    }

    if (this.attrValueToken[Token.TYPE_ID]) {
      this.attrTokens.push(this.attrValueToken);
      this.attrValueToken = this.dummyToken;
    }
  }

  flushAttrs() {
    if (this.attrTokens.length) {
      this.attrTokens.forEach(this.appendToken.bind(this));
      this.attrTokens = [];
    }
  }

  charSPACE(charCode) {
    this.flushWord();

    if (this.tagToken[Token.TYPE_ID]) {
      this.attrNameToken = this.createAttrNameToken('');
    } else {
      const spaceCode = charCode === TAB ? PLACEHOLDER_SPACE_TAB : PLACEHOLDER_SPACE;

      this.appendToken(this.createSpaceToken(spaceCode));
    }
    this.nextCol();
  }

  charN(charCode) {
    this.flushWord();
    this.appendToken(this.createNewLineToken(getChar(charCode)));

    this.nextLine();
    this.colPos = 0;
  }

  charOPENBRAKET() {
    this.flushWord();
    this.tagToken = this.createTagToken('');

    this.nextCol();
  }

  charCLOSEBRAKET() {
    this.flushTag();
    this.flushAttrNames();
    this.flushAttrs();

    this.nextCol();
  }

  charEQ(charCode) {
    if (this.tagToken[Token.TYPE_ID]) {
      this.attrValueToken = this.createAttrValueToken('');
    } else {
      this.wordToken[Token.VALUE_ID] += getChar(charCode);
    }

    this.nextCol();
  }

  charQUOTEMARK(charCode) {
    if (this.attrValueToken[Token.TYPE_ID] && this.attrValueToken[Token.VALUE_ID] > 0) {
      this.flushAttrNames();
    } else if (this.tagToken[Token.TYPE_ID] === '') {
      this.wordToken[Token.VALUE_ID] += getChar(charCode);
    }

    this.nextCol();
  }

  charWORD(charCode) {
    if (this.tagToken[Token.TYPE_ID] && this.attrValueToken[Token.TYPE_ID]) {
      this.attrValueToken[Token.VALUE_ID] += getChar(charCode);
    } else if (this.tagToken[Token.TYPE_ID] && this.attrNameToken[Token.TYPE_ID]) {
      this.attrNameToken[Token.VALUE_ID] += getChar(charCode);
    } else if (this.tagToken[Token.TYPE_ID]) {
      this.tagToken[Token.VALUE_ID] += getChar(charCode);
    } else {
      this.createWord();

      this.wordToken[Token.VALUE_ID] += getChar(charCode);
    }

    this.nextCol();
  }

  tokenize() {
    while (this.index < this.buffer.length) {
      const charCode = this.buffer.charCodeAt(this.index);

      switch (charCode) {
        case TAB:
        case SPACE:
          this.charSPACE(charCode);
          break;

        case N:
          this.charN(charCode);
          break;

        case OPEN_BRAKET:
          this.charOPENBRAKET();
          break;

        case CLOSE_BRAKET:
          this.charCLOSEBRAKET();
          break;

        case EQ:
          this.charEQ(charCode);
          break;

        case QUOTEMARK:
          this.charQUOTEMARK(charCode);
          break;

        default:
          this.charWORD(charCode);
          break;
      }

      this.index += 1;
    }

    this.flushWord();
    this.flushUnclosedTag();

    this.tokens.length = this.tokenIndex + 1;

    return this.tokens;
  }

  createWordToken(value = '', line = this.colPos, row = this.rowPos) {
    return createTokenOfType(Token.TYPE_WORD, value, line, row);
  }

  createTagToken(value, line = this.colPos, row = this.rowPos) {
    return createTokenOfType(Token.TYPE_TAG, value, line, row);
  }

  createAttrNameToken(value, line = this.colPos, row = this.rowPos) {
    return createTokenOfType(Token.TYPE_ATTR_NAME, value, line, row);
  }

  createAttrValueToken(value, line = this.colPos, row = this.rowPos) {
    return createTokenOfType(Token.TYPE_ATTR_VALUE, value, line, row);
  }

  createSpaceToken(value, line = this.colPos, row = this.rowPos) {
    return createTokenOfType(Token.TYPE_SPACE, value, line, row);
  }

  createNewLineToken(value, line = this.colPos, row = this.rowPos) {
    return createTokenOfType(Token.TYPE_NEW_LINE, value, line, row);
  }

  isTokenNested(token) {
    const value = getChar(OPEN_BRAKET) + getChar(SLASH) + Token.getTokenValue(token);
    return this.buffer.indexOf(value) > -1;
  }
}

// warm up tokenizer to elimitate code branches that never execute
new Tokenizer('[b param="hello"]Sample text[/b]\n\t[Chorus 2] x html([a. title][, alt][, classes]) x [=] [/y]').tokenize();

module.exports = Tokenizer;
module.exports.createTokenOfType = createTokenOfType;
module.exports.TYPE = {
  WORD: Token.TYPE_WORD,
  TAG: Token.TYPE_TAG,
  ATTR_NAME: Token.TYPE_ATTR_NAME,
  ATTR_VALUE: Token.TYPE_ATTR_VALUE,
  SPACE: Token.TYPE_SPACE,
  NEW_LINE: Token.TYPE_NEW_LINE,
};
module.exports.TOKEN = {
  TYPE_ID: Token.TYPE_ID,
  VALUE_ID: Token.VALUE_ID,
  LINE_ID: Token.LINE_ID,
  COLUMN_ID: Token.COLUMN_ID,
};
