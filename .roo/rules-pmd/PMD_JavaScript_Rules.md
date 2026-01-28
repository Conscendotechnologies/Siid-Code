# PMD JavaScript (ECMAScript) Rules - AI Instructions

## Overview

Follow these PMD (Programming Mistake Detector) rules when analyzing or generating JavaScript (ECMAScript) code. PMD is a static code analyzer that identifies common programming flaws in JavaScript code.

---

## Best Practices

### 1. AvoidWithStatement

**Priority:** High (1)

**Rule:**  
Avoid using `with` - it's bad news. The `with` statement is deprecated and causes numerous problems.

**Purpose:**

- Makes code ambiguous and hard to understand
- Creates performance issues
- Can lead to unexpected variable resolution
- Deprecated in strict mode (causes SyntaxError)
- Prevents JavaScript engine optimizations

**Example Violation:**

```javascript
// Bad - using with statement
with (someObject) {
	property1 = value1
	property2 = value2
}
```

**Correct Approach:**

```javascript
// Good - explicit property access
someObject.property1 = value1
someObject.property2 = value2
```

**Why it's problematic:**

```javascript
var x = 10
var obj = { x: 20 }

with (obj) {
	console.log(x) // Is this obj.x or global x? Ambiguous!
	y = 30 // Creates global y accidentally if obj.y doesn't exist
}
```

---

### 2. ConsistentReturn

**Priority:** Medium (3)

**Rule:**  
ECMAScript does not provide for return types on functions, and therefore there is no solid rule as to whether a function should always return a value or never return a value. However, it's best practice to be consistent.

**Purpose:**

- Inconsistent returns lead to bugs
- Makes function behavior unpredictable
- Can cause `undefined` to be returned unexpectedly
- Harder to reason about function output

**Example Violations:**

```javascript
// Bad - inconsistent returns
function getValue(condition) {
	if (condition) {
		return 42
	}
	// Implicitly returns undefined
}

// Bad - mixing return types
function process(data) {
	if (!data) {
		return // Returns undefined
	}
	return data.value // Returns a value
}
```

**Correct Approach:**

```javascript
// Good - always returns a value
function getValue(condition) {
	if (condition) {
		return 42
	}
	return 0 // Explicit default return
}

// Good - always returns undefined (void function)
function logMessage(msg) {
	console.log(msg)
	return // Explicit return undefined
}

// Good - clear return type (number or null)
function calculate(input) {
	if (!input) {
		return null
	}
	return input * 2
}
```

---

### 3. GlobalVariable

**Priority:** High (1)

**Rule:**  
This rule helps to avoid using accidental global variables by simply missing the "var" declaration. Global variables pollute the global namespace and can cause conflicts.

**Purpose:**

- Prevents namespace pollution
- Avoids variable conflicts
- Improves code maintainability
- Prevents memory leaks
- Makes variable scope explicit

**Example Violations:**

```javascript
// Bad - creates global variable
function calculate() {
	result = 10 * 5 // Missing var/let/const
	return result
}

// Bad - typo creates global
function process() {
	var userName = "John"
	usrName = "Jane" // Typo creates global
}
```

**Correct Approach:**

```javascript
// Good - proper variable declaration
function calculate() {
	var result = 10 * 5 // ES5
	return result
}

function calculateModern() {
	let result = 10 * 5 // ES6 - block scoped
	return result
}

function calculateConst() {
	const result = 10 * 5 // ES6 - immutable
	return result
}
```

**Modern Best Practice:**

```javascript
// Use strict mode to catch accidental globals
"use strict"

function calculate() {
	result = 10 * 5 // Throws ReferenceError in strict mode
}
```

---

### 4. ScopeForInVariable

**Priority:** Medium (3)

**Rule:**  
A for-in loop in which the variable name is not explicitly scoped to the enclosing scope with the `var` keyword can refer to a variable in an enclosing scope.

**Purpose:**

- Prevents unintended variable overwrites
- Makes variable scope explicit
- Avoids bugs from variable hoisting
- Improves code clarity

**Example Violation:**

```javascript
// Bad - loop variable not scoped
function iterate(obj) {
	for (key in obj) {
		// 'key' becomes global
		console.log(key)
	}
}
```

**Correct Approach:**

```javascript
// Good - ES5 style
function iterate(obj) {
	for (var key in obj) {
		console.log(key)
	}
}

// Better - ES6 style
function iterate(obj) {
	for (const key in obj) {
		console.log(key)
	}
}

// Best - use Object methods
function iterate(obj) {
	Object.keys(obj).forEach((key) => {
		console.log(key)
	})
}
```

---

### 5. UseBaseWithParseInt

**Priority:** Medium (3)

**Rule:**  
This rule checks for usages of `parseInt`. While the second parameter is optional and usually defaults to 10 (decimal), it's best practice to always specify the radix explicitly.

**Purpose:**

- Prevents unexpected octal/hexadecimal parsing
- Makes intent explicit
- Avoids browser inconsistencies
- Improves code clarity

**Example Violations:**

```javascript
// Bad - missing radix
var num = parseInt("08") // May parse as octal (0) in some environments
var hex = parseInt("0x10") // Works but unclear
var value = parseInt(userInput) // Dangerous without radix
```

**Correct Approach:**

```javascript
// Good - explicit radix
var num = parseInt("08", 10) // Always decimal
var hex = parseInt("10", 16) // Explicit hexadecimal
var binary = parseInt("1010", 2) // Binary parsing
var value = parseInt(userInput, 10) // Safe parsing
```

**Why it matters:**

```javascript
// Surprising behavior without radix
parseInt("08") // 8 in modern browsers, but 0 in older ones (octal)
parseInt("0x10") // 16 (hexadecimal)
parseInt("10", 10) // 10 (explicit decimal)
parseInt("10", 8) // 8 (explicit octal)
parseInt("10", 16) // 16 (explicit hexadecimal)
```

---

## Code Style

### 1. AssignmentInOperand

**Priority:** Medium (3)

**Rule:**  
Avoid assignments in operands; this can make code more complicated and harder to read. This is sometimes referred to as a "Yoda condition".

**Purpose:**

- Reduces code complexity
- Prevents accidental assignment bugs
- Improves readability
- Makes intent clearer

**Example Violations:**

```javascript
// Bad - assignment in condition
if ((x = 10)) {
	// Assignment, not comparison!
	console.log(x)
}

// Bad - assignment in while condition
while ((node = node.nextSibling)) {
	process(node)
}

// Bad - complex assignment in operand
if ((result = calculate()) > 0) {
	use(result)
}
```

**Correct Approach:**

```javascript
// Good - separate assignment and condition
x = 10
if (x === 10) {
	console.log(x)
}

// Good - clear loop logic
node = node.nextSibling
while (node) {
	process(node)
	node = node.nextSibling
}

// Good - separate concerns
result = calculate()
if (result > 0) {
	use(result)
}
```

**When assignment in condition might be acceptable:**

```javascript
// Sometimes used in parsing loops (but still discouraged)
while ((match = regex.exec(str)) !== null) {
	console.log(match)
}

// Better alternative
let match
while ((match = regex.exec(str)) !== null) {
	console.log(match)
}
```

---

### 2. ForLoopsMustUseBraces

**Priority:** Medium (3)

**Rule:**  
Avoid using 'for' statements without using curly braces. Single-line loops are error-prone when modified.

**Purpose:**

- Prevents bugs when adding statements
- Improves code consistency
- Makes structure explicit
- Easier to debug

**Example Violation:**

```javascript
// Bad - no braces
for (var i = 0; i < 10; i++) console.log(i)
```

**Correct Approach:**

```javascript
// Good - with braces
for (var i = 0; i < 10; i++) {
	console.log(i)
}
```

---

### 3. IfElseStmtsMustUseBraces

**Priority:** Medium (3)

**Rule:**  
Avoid using if..else statements without using curly braces. This prevents bugs when code is modified.

**Purpose:**

- Prevents the "Apple goto fail" bug
- Makes code structure clear
- Safer for future modifications
- Consistent code style

**Example Violations:**

```javascript
// Bad - no braces
if (condition) doSomething()
else doSomethingElse()
```

**Correct Approach:**

```javascript
// Good - with braces
if (condition) {
	doSomething()
} else {
	doSomethingElse()
}
```

---

### 4. IfStmtsMustUseBraces

**Priority:** Medium (3)

**Rule:**  
Avoid using if statements without using curly braces. Missing braces can lead to errors.

**Purpose:**

- Prevents accidental bugs
- Improves maintainability
- Makes intent clear
- Consistent formatting

**Example Violation:**

```javascript
// Bad - no braces
if (isValid) process()
```

**Correct Approach:**

```javascript
// Good - with braces
if (isValid) {
	process()
}
```

---

### 5. NoElseReturn

**Priority:** Low (5)

**Rule:**  
The else block in an if-else-construct is unnecessary if the 'if' block contains a return. Then the content of the else block can be put outside.

**Purpose:**

- Reduces nesting
- Simplifies code structure
- Improves readability
- Eliminates unnecessary else blocks

**Example Violation:**

```javascript
// Bad - unnecessary else
function getValue(condition) {
	if (condition) {
		return true
	} else {
		return false
	}
}

// Bad - nested returns
function process(data) {
	if (data.valid) {
		return data.value
	} else {
		return null
	}
}
```

**Correct Approach:**

```javascript
// Good - early return
function getValue(condition) {
	if (condition) {
		return true
	}
	return false
}

// Good - guard clause pattern
function process(data) {
	if (data.valid) {
		return data.value
	}
	return null
}

// Even better - simplified
function getValue(condition) {
	return condition
}
```

---

### 6. UnnecessaryBlock

**Priority:** Low (5)

**Rule:**  
An unnecessary Block is present. Such Blocks are often used in other languages to introduce a new scope, but JavaScript's function scoping makes them unnecessary.

**Purpose:**

- Simplifies code
- Removes confusion
- Follows JavaScript conventions
- Use let/const for block scoping instead

**Example Violations:**

```javascript
// Bad - unnecessary block
function calculate() {
	var x = 10
	{
		var y = 20
		console.log(x + y)
	}
}
```

**Correct Approach:**

```javascript
// Good - no unnecessary block
function calculate() {
	var x = 10
	var y = 20
	console.log(x + y)
}

// Or use block scope with let/const (ES6)
function calculate() {
	const x = 10
	{
		const y = 20 // Block-scoped with let/const
		console.log(x + y)
	}
}
```

---

### 7. UnnecessaryParentheses

**Priority:** Low (5)

**Rule:**  
Unnecessary parentheses should be removed for cleaner code.

**Purpose:**

- Reduces visual clutter
- Improves readability
- Simplifies expressions

**Example Violations:**

```javascript
// Bad - unnecessary parentheses
var x = 5
if (a === b) {
	// ...
}
return value
```

**Correct Approach:**

```javascript
// Good - clean code
var x = 5
if (a === b) {
	// ...
}
return value
```

---

### 8. UnreachableCode

**Priority:** High (1)

**Rule:**  
A 'return', 'break', 'continue', or 'throw' statement should be the last in a block. Statements after these are unreachable and indicate a logic error.

**Purpose:**

- Indicates dead code
- Points to logic errors
- Wastes resources
- Confuses developers

**Example Violations:**

```javascript
// Bad - unreachable code
function process() {
	return true
	console.log("This never executes") // Unreachable
}

// Bad - unreachable after throw
function validate(data) {
	throw new Error("Invalid")
	return data // Unreachable
}
```

**Correct Approach:**

```javascript
// Good - reachable code
function process() {
	console.log("This executes")
	return true
}

function validate(data) {
	if (!data) {
		throw new Error("Invalid")
	}
	return data
}
```

---

### 9. WhileLoopsMustUseBraces

**Priority:** Medium (3)

**Rule:**  
Avoid using 'while' statements without using curly braces.

**Purpose:**

- Prevents modification bugs
- Improves consistency
- Makes structure clear

**Example Violation:**

```javascript
// Bad - no braces
while (condition) process()
```

**Correct Approach:**

```javascript
// Good - with braces
while (condition) {
	process()
}
```

---

## Error Prone

### 1. AvoidTrailingComma

**Priority:** High (1)

**Rule:**  
This rule helps improve code portability due to differences in browser treatment of trailing commas in object and array literals.

**Purpose:**

- IE8 and earlier throw errors on trailing commas
- Inconsistent browser behavior
- Can cause JSON parsing errors
- Portability issues

**Example Violations:**

```javascript
// Bad - trailing commas
var obj = {
	name: "John",
	age: 30, // Trailing comma
}

var arr = [1, 2, 3] // Trailing comma
```

**Correct Approach:**

```javascript
// Good - no trailing commas
var obj = {
	name: "John",
	age: 30,
}

var arr = [1, 2, 3]
```

**Note:** Modern JavaScript (ES5+) allows trailing commas, but this rule helps with legacy browser support.

---

### 2. EqualComparison

**Priority:** High (1)

**Rule:**  
Using `==` in conditions may lead to unexpected results, as the variables are automatically casted to be of the same type. Use `===` for strict equality.

**Purpose:**

- Prevents type coercion bugs
- Makes comparisons predictable
- Improves code reliability
- Follows best practices

**Example Violations:**

```javascript
// Bad - type coercion with ==
if (value == "5") {
	// true for value = 5 (number)
	// ...
}

// Bad - surprising results
"" == false // true
0 == false // true
null == undefined // true
```

**Correct Approach:**

```javascript
// Good - strict equality
if (value === "5") {
	// Only true for string "5"
	// ...
}

// Good - explicit comparisons
"" === false // false
0 === false // false
null === undefined // false
```

**Type Coercion Examples:**

```javascript
// Surprising == behavior
5 == "5" // true
false == "0" // true
false == "" // true
false == [] // true

// Expected === behavior
5 === "5" // false
false === "0" // false
false === "" // false
false === [] // false
```

---

### 3. InaccurateNumericLiteral

**Priority:** Medium (3)

**Rule:**  
The numeric literal will have a different value at runtime, which can happen if you provide too many digits or use exponential notation incorrectly.

**Purpose:**

- Prevents precision loss
- Catches typos
- Ensures accurate calculations
- Prevents floating-point errors

**Example Violations:**

```javascript
// Bad - too many digits (precision loss)
var x = 9999999999999999999999 // Stored as 10000000000000000000000

// Bad - incorrect exponential
var y = 1e999 // Infinity
```

**Correct Approach:**

```javascript
// Good - use appropriate precision
var x = 9999999999999999 // Within safe integer range

// Good - use BigInt for large integers (ES2020)
var big = 9999999999999999999999n

// Good - proper exponential notation
var y = 1e10 // 10000000000
```

---

### 4. InnaccurateNumericLiteral

**Status:** Deprecated

**Rule:**  
The rule has been renamed. Use `InaccurateNumericLiteral` instead.

---

## Performance

### 1. AvoidConsoleStatements

**Priority:** Medium (3)

**Rule:**  
Using the console for logging in production might negatively impact performance. In addition, logging sensitive information to the console is a security risk.

**Purpose:**

- Console operations are slow
- Logs may expose sensitive data
- Can cause memory leaks (large objects)
- Should be removed before production
- Impacts user experience

**Example Violations:**

```javascript
// Bad - console in production code
function processPayment(cardNumber) {
	console.log("Processing card:", cardNumber) // Security risk!
	// ...
}

function calculate() {
	console.log("Starting calculation")
	// ... complex logic
	console.log("Result:", result)
}
```

**Correct Approach:**

```javascript
// Good - use proper logging library
const logger = require("./logger")

function processPayment(cardNumber) {
	logger.debug("Processing payment") // No sensitive data
	// ...
}

// Good - conditional logging
function calculate() {
	if (DEBUG_MODE) {
		console.log("Starting calculation")
	}
	// ... logic
}

// Good - remove in production
function process() {
	// console.log("Debug info");  // Commented out
	// ... production code
}
```

**Build-time removal:**

```javascript
// Use build tools to strip console statements
// webpack, rollup, etc. can remove console.* in production

// Or use a logger that can be disabled
const log = process.env.NODE_ENV === "production" ? () => {} : console.log
```

---

## Modern JavaScript Best Practices

### ES6+ Recommendations

1. **Use `const` and `let` instead of `var`:**

    ```javascript
    const MAX_VALUE = 100
    let counter = 0
    ```

2. **Use strict mode:**

    ```javascript
    "use strict"
    ```

3. **Use arrow functions:**

    ```javascript
    const square = (x) => x * x
    ```

4. **Use template literals:**

    ```javascript
    const message = `Hello, ${name}!`
    ```

5. **Use destructuring:**
    ```javascript
    const { name, age } = user
    ```

---

## Quick Reference

| Category       | Rules | Key Focus                                                       |
| -------------- | ----- | --------------------------------------------------------------- |
| Best Practices | 5     | with statements, consistent returns, global variables, parseInt |
| Code Style     | 9     | Braces, parentheses, code structure                             |
| Error Prone    | 4     | Type coercion, trailing commas, numeric precision               |
| Performance    | 1     | Console statements                                              |

---
