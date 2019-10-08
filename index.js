/**
 * First phase of parsing, lexical analysis
 * We're just going to take our string of code
 * and break it down into an array of tokens.
 * @param {string} input string of code
 * @returns {Array<{type: string, value: string}>} tokens array
 */
function tokenizer(input) {
    const WHITESPACE_REG = /\s/;
    const NUMBERS_REG = /[0-9]/;
    const LETTERS_REG = /[a-z]/i;
    const input_length = input.length;

    let current = 0; // position in the code
    let current_char = ''; // store the `current` character in the `input`
    let value = ''; // store number characters in `value` string
    let tokens = [];

    while (current < input_length) {
        current_char = input[current];

        // check open parenthesis
        if (current_char === '(') {
            tokens.push({ type: 'paren', value: '(' });
            current++;
            continue;
        }

        // check closing parenthesis
        if (current_char === ')') {
            tokens.push({ type: 'paren', value: ')' });
            current++;
            continue;
        }

        // check whitespace
        if (WHITESPACE_REG.test(current_char)) {
            current++;
            continue;
        }

        // check number
        if (NUMBERS_REG.test(current_char)) {
            value = '';

            while (NUMBERS_REG.test(current_char)) {
                value += current_char;
                current_char = input[++current];
            }

            tokens.push({ type: 'number', value });
            continue;
        }

        // check strings which will be any text surrounded by double quotes (")
        if (current_char === '"') {
            value = '';

            current_char = input[++current];

            while (current_char !== '"') {
                value += current_char;
                current_char = input[++current];
            }

            current_char = input[++current];

            tokens.push({ type: 'string', value });
            continue;
        }

        // check the names of functions in our syntax
        if (LETTERS_REG.test(current_char)) {
            value = '';

            while (LETTERS_REG.test(current_char)) {
                value += current_char;
                current_char = input[++current];
            }

            tokens.push({ type: 'name', value });
            continue;
        }

        // throw an error and completetly exit when note match a character
        throw new TypeError(`Unknown character: ${current_char}`);
    }

    return tokens;
}

/**
 * Take array of tokens and turn it into an AST
 * @param {Array<{type: string, value: string}>} tokens
 * @returns {{type: string, body: Array}} AST
 */
function parser(tokens) {
    let current = 0; // keep a `current` variable

    let walk = function() {
        let token = tokens[current]; // grabbing the `current` token

        // check `number` tokens
        if (token.type === 'number') {
            current++;
            return {
                type: 'NumberLiteral',
                value: token.value
            };
        }

        // check `string` tokens
        if (token.type === 'string') {
            current++;
            return {
                type: 'StringLiteral',
                value: token.value
            };
        }

        // check open parenthesis
        if (token.type === 'paren' && token.value === '(') {
            token = tokens[++current];

            let node = {
                type: 'CallExpression',
                name: token.value,
                params: []
            };

            token = tokens[++current];

            while (
                token.type !== 'paren' ||
                (token.type === 'paren' && token.value !== ')')
            ) {
                node.params.push(walk());
                token = tokens[current];
            }

            current++;
            return node;
        }

        // throw an error, when we haven't recognized the token type
        throw new TypeError(token.type);
    };

    // AST root `Program` node
    let AST = { type: 'Program', body: [] };

    while (current < tokens.length) {
        AST.body.push(walk());
    }

    return AST;
}
/**
 * Visit different nodes with a visitor and call the methods on the visitor
 * when node with a matching type
 * @param {{type: string, body: Array}} AST
 * @param {*} visitor
 */
function traverser(AST, visitor) {
    // Iterate over an array and call `traverse_node` function
    let traverse_array = function(array, parent) {
        array.forEach(child => {
            traverse_node(child, parent);
        });
    };

    // Pass node & parent to our visitor methods
    let traverse_node = function(node, parent) {
        let methods = visitor[node.type]; // a method on the visitor with a matching `type`

        if (methods && methods.enter) {
            methods.enter(node, parent);
        }

        switch (node.type) {
            case 'Program':
                traverse_array(node.body, node);
                break;
            case 'CallExpression':
                traverse_array(node.params, node);
                break;
            case 'NumberLiteral':
                break;
            case 'StringLiteral':
                break;
            default:
                throw new TypeError(node.type);
        }

        if (methods && methods.exit) {
            methods.exit(node, parent);
        }
    };

    traverse_node(AST, null);
}

/**
 * Take the AST and pass it to traverser function with a visitor
 * and will create a new ast
 * @param {{type: string, body: Array}} AST
 * @returns {{type: string, body: Array}} new AST
 */
function transformer(AST) {
    const VISITOR = {
        NumberLiteral: {
            enter(node, parent) {
                parent._context.push({
                    type: 'NumberLiteral',
                    value: node.value
                });
            }
        },
        StringLiteral: {
            enter(node, parent) {
                parent._context.push({
                    type: 'StringLiteral',
                    value: node.value
                });
            }
        },
        CallExpression: {
            enter(node, parent) {
                // Create a new node `CallExpression` with a nested `Identifier`
                let expression = {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: node.name
                    },
                    arguments: []
                };

                node._context = expression.arguments;

                if (parent.type !== 'CallExpression') {
                    expression = {
                        type: 'ExpressionStatement',
                        expression: expression
                    };
                }

                parent._context.push(expression);
            }
        }
    };

    let new_ast = {
        type: 'Program',
        body: []
    };

    AST._context = new_ast.body;
    traverser(AST, VISITOR);
    return new_ast;
}

/**
 * Print each node in the tree into one giant string
 * @param {*} node
 * @returns {string} node string
 */
function code_generator(node) {
    switch (node.type) {
        case 'Program':
            return node.body.map(code_generator).join('\n');
        case 'ExpressionStatement':
            return code_generator(node.expression) + ';';
        case 'CallExpression':
            return (
                code_generator(node.callee) +
                '(' +
                node.arguments.map(code_generator).join(', ') +
                ')'
            );
        case 'Identifier':
            return node.name;
        case 'NumberLiteral':
            return node.value;
        case 'StringLiteral':
            return '"' + node.value + '"';
        default:
            throw new TypeError(node.type);
    }
}

/**
 * `compiler` function
 * 1. input  -> tokenizer   -> tokens
 * 2. tokens -> parser      -> ast
 * 3. ast    -> transformer -> newAst
 * 4. newAst -> generator   -> output
 * @param {string} input
 * @returns {string} output
 */
function compiler(input) {
    let tokens = tokenizer(input);
    let ast = parser(tokens);
    let new_ast = transformer(ast);
    let output = code_generator(new_ast);

    return output;
}

// Just exporting everything...
module.exports = {
    tokenizer,
    parser,
    traverser,
    transformer,
    code_generator,
    compiler
};
