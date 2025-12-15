# PMD XML Rules - AI Instructions

## Overview

Follow these PMD (Programming Mistake Detector) rules when analyzing or generating XML documents. PMD is a static code analyzer that identifies common issues in XML.

---

## Best Practices

### 1. MissingEncoding

**Priority:** Medium (3)

**Rule:**  
When the character encoding is missing from the XML declaration, the parser may produce garbled text or unexpected results if the document contains non-ASCII characters.

**Purpose:**

- Prevents character encoding issues
- Ensures consistent text representation
- Improves portability across systems
- Prevents data corruption
- Makes encoding explicit and documented

**Example Violations:**

```xml
<!-- Bad - Missing encoding declaration -->
<?xml version="1.0"?>
<root>
    <data>Special characters: áéíóú ñ ç</data>
</root>

<!-- Bad - No XML declaration at all -->
<root>
    <content>Some text with special chars: €£¥</content>
</root>
```

**Correct Approach:**

```xml
<!-- Good - Encoding specified (UTF-8) -->
<?xml version="1.0" encoding="UTF-8"?>
<root>
    <data>Special characters: áéíóú ñ ç €£¥</data>
</root>

<!-- Good - Encoding specified (ISO-8859-1) -->
<?xml version="1.0" encoding="ISO-8859-1"?>
<root>
    <data>Latin characters: áéíóú</data>
</root>

<!-- Good - Encoding specified (UTF-16) -->
<?xml version="1.0" encoding="UTF-16"?>
<root>
    <data>Unicode text: 你好世界</data>
</root>
```

**Common Encoding Standards:**

1. **UTF-8** (Recommended default)

    - Universal character support
    - Backward compatible with ASCII
    - Variable-length encoding (1-4 bytes)
    - Most widely used on the web

    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    ```

2. **UTF-16**

    - Wide character support
    - Fixed 2-byte or 4-byte encoding
    - Common in Windows systems

    ```xml
    <?xml version="1.0" encoding="UTF-16"?>
    ```

3. **ISO-8859-1 (Latin-1)**

    - Western European characters
    - Single-byte encoding
    - Legacy support

    ```xml
    <?xml version="1.0" encoding="ISO-8859-1"?>
    ```

4. **ASCII**
    - Basic English characters
    - 7-bit encoding
    - Limited character set
    ```xml
    <?xml version="1.0" encoding="ASCII"?>
    ```

**Why Encoding Matters:**

Without proper encoding declaration, parsers may:

- Interpret characters incorrectly
- Display garbled text (mojibake)
- Fail to parse the document
- Corrupt data during processing
- Cause compatibility issues across systems

**Real-World Example:**

```xml
<!-- Without encoding - may display incorrectly -->
<?xml version="1.0"?>
<invoice>
    <customer>François Müller</customer>
    <amount currency="€">1.234,56</amount>
    <note>Preço especial</note>
</invoice>

<!-- With proper encoding - displays correctly -->
<?xml version="1.0" encoding="UTF-8"?>
<invoice>
    <customer>François Müller</customer>
    <amount currency="€">1.234,56</amount>
    <note>Preço especial</note>
</invoice>
```

**Best Practices for Encoding:**

1. Always declare encoding in the XML declaration
2. Use UTF-8 by default unless you have specific requirements
3. Match file encoding with declared encoding
4. Be consistent across all XML files in a project
5. Test with special characters to verify correct encoding
6. Document encoding choices in project standards

**XML Declaration Components:**

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
         ^^^^^^^       ^^^^^^^^^       ^^^^^^^^^^^^^
         Version       Encoding        Standalone declaration
         (Required)    (Recommended)   (Optional)
```

- **version:** XML version (typically "1.0" or "1.1")
- **encoding:** Character encoding (UTF-8, UTF-16, ISO-8859-1, etc.)
- **standalone:** Whether document has external dependencies ("yes" or "no")

**Platform-Specific Considerations:**

```xml
<!-- Unix/Linux/Mac - UTF-8 is standard -->
<?xml version="1.0" encoding="UTF-8"?>

<!-- Windows - May default to UTF-16 or Windows-1252 -->
<?xml version="1.0" encoding="UTF-16"?>

<!-- Web APIs - UTF-8 is standard -->
<?xml version="1.0" encoding="UTF-8"?>

<!-- Legacy systems - May require specific encoding -->
<?xml version="1.0" encoding="ISO-8859-1"?>
```

---

## Error Prone

### 1. MistypedCDATASection

**Priority:** High (1)

**Rule:**  
An XML CDATA section begins with a `<![CDATA[` marker, which has only one `[`, and ends with a `]]>` marker. This rule detects common typos in CDATA section markers.

**Purpose:**

- CDATA sections must have correct syntax
- Typos cause parsing errors
- Data may be misinterpreted
- Can expose code or content incorrectly
- Prevents XML validation failures

**What is CDATA:**

CDATA (Character Data) sections allow you to include text that should not be parsed by the XML parser. This is useful for:

- JavaScript code
- JSON data
- HTML content
- Special characters (< > & ")
- Code samples

**Correct CDATA Syntax:**

```xml
<![CDATA[
    Content here is not parsed
]]>
```

**Example Violations:**

```xml
<!-- Bad - Double opening bracket (too many '[') -->
<element>
    <script>
        <[CDATA[[
            function example() {
                if (x < 5 && y > 3) {
                    return true;
                }
            }
        ]]>
    </script>
</element>

<!-- Bad - Wrong closing marker -->
<element>
    <![CDATA[
        Some content with < and > characters
    ]>
</element>

<!-- Bad - Missing exclamation mark -->
<element>
    <[CDATA[
        var x = "<tag>";
    ]]>
</element>

<!-- Bad - Extra brackets -->
<element>
    <![CDATA[[
        Content here
    ]]>
</element>
```

**Correct Approach:**

```xml
<!-- Good - Correct CDATA syntax -->
<script>
    <![CDATA[
        function example() {
            if (x < 5 && y > 3) {
                return true;
            }
        }
    ]]>
</script>

<!-- Good - JavaScript with special characters -->
<script type="text/javascript">
    <![CDATA[
        var html = "<div>Hello & goodbye</div>";
        if (a < b && c > d) {
            console.log("condition met");
        }
    ]]>
</script>

<!-- Good - JSON data -->
<data>
    <![CDATA[
        {
            "name": "John",
            "age": 30,
            "active": true
        }
    ]]>
</data>

<!-- Good - HTML content -->
<description>
    <![CDATA[
        <p>This is <strong>bold</strong> text.</p>
        <div class="container">
            <span>Content</span>
        </div>
    ]]>
</description>
```

**Common CDATA Use Cases:**

1. **JavaScript Code:**

```xml
<html>
    <script>
        <![CDATA[
            function validate() {
                if (x < 10 && y > 5) {
                    return x < y;
                }
            }
        ]]>
    </script>
</html>
```

2. **SQL Queries:**

```xml
<query>
    <![CDATA[
        SELECT * FROM users
        WHERE age > 18 AND status = 'active'
        ORDER BY name
    ]]>
</query>
```

3. **XML Content as Text:**

```xml
<example>
    <![CDATA[
        <root>
            <element attribute="value">
                Text content
            </element>
        </root>
    ]]>
</example>
```

4. **Mathematical Expressions:**

```xml
<formula>
    <![CDATA[
        if (a < b && c > d) {
            result = a + b * c / d;
        }
    ]]>
</formula>
```

5. **Regular Expressions:**

```xml
<pattern>
    <![CDATA[
        ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$
    ]]>
</pattern>
```

**CDATA Syntax Rules:**

| Component | Syntax                      | Required |
| --------- | --------------------------- | -------- |
| Opening   | `<![CDATA[`                 | Yes      |
| Content   | Any characters except `]]>` | No       |
| Closing   | `]]>`                       | Yes      |

**What Can Be Inside CDATA:**

✓ **Allowed:**

- Special characters: `< > & " '`
- Code snippets
- JSON/XML as text
- Mathematical operators
- Any text content

✗ **Not Allowed:**

- The sequence `]]>` (ends CDATA)
- Nested CDATA sections

**Escaping the Ending Sequence:**

If you need `]]>` inside CDATA:

```xml
<!-- Problem: ]]> ends CDATA prematurely -->
<![CDATA[
    This text contains ]]> in it  <!-- ERROR -->
]]>

<!-- Solution: Split into multiple CDATA sections -->
<![CDATA[This text contains ]]]]><![CDATA[> in it]]>
```

**CDATA vs Entity Encoding:**

```xml
<!-- Without CDATA - must use entities -->
<element>
    &lt;div&gt;Content&lt;/div&gt;
    a &lt; b &amp;&amp; c &gt; d
</element>

<!-- With CDATA - natural syntax -->
<element>
    <![CDATA[
        <div>Content</div>
        a < b && c > d
    ]]>
</element>
```

**When to Use CDATA:**

**Use CDATA when:**

- Embedding code (JavaScript, SQL, etc.)
- Content has many special characters
- Preserving formatting is important
- Content includes XML-like syntax

**Don't use CDATA when:**

- Simple text without special characters
- You need XML parsing of the content
- Mixing text and XML elements
- Content is empty or minimal

**Common Typos to Avoid:**

```xml
<!-- Wrong: Extra bracket -->
<[CDATA[[content]]>

<!-- Wrong: Missing exclamation -->
<[CDATA[content]]>

<!-- Wrong: Space in marker -->
<! [CDATA[content]]>

<!-- Wrong: Wrong closing -->
<![CDATA[content]>

<!-- Correct -->
<![CDATA[content]]>
```

---

## XML Well-Formedness Rules

While PMD focuses on specific issues, remember these XML fundamentals:

### Basic XML Requirements

1. **Single Root Element:**

```xml
<!-- Good -->
<root>
    <child1/>
    <child2/>
</root>

<!-- Bad - multiple roots -->
<root1/>
<root2/>
```

2. **Proper Nesting:**

```xml
<!-- Good -->
<parent>
    <child>
        <grandchild/>
    </child>
</parent>

<!-- Bad - improper nesting -->
<parent>
    <child>
        <grandchild>
    </child>
        </grandchild>
</parent>
```

3. **Closed Tags:**

```xml
<!-- Good -->
<element>content</element>
<selfClosing/>

<!-- Bad -->
<element>content
<notClosed>
```

4. **Quoted Attributes:**

```xml
<!-- Good -->
<element attr="value" id="123"/>

<!-- Bad -->
<element attr=value id=123/>
```

---

## XML Best Practices Beyond PMD

### 1. Use XML Schema or DTD

```xml
<!-- With XML Schema -->
<?xml version="1.0" encoding="UTF-8"?>
<root xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="schema.xsd">
    <element>Content</element>
</root>

<!-- With DTD -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root SYSTEM "document.dtd">
<root>
    <element>Content</element>
</root>
```

### 2. Use Namespaces Properly

```xml
<?xml version="1.0" encoding="UTF-8"?>
<root xmlns:app="http://example.com/app"
      xmlns:data="http://example.com/data">
    <app:config>
        <app:setting>value</app:setting>
    </app:config>
    <data:records>
        <data:record id="1"/>
    </data:records>
</root>
```

---

## Common XML Pitfalls

### 1. Character Encoding Issues

```xml
<!-- Problem: File encoded as UTF-8 but declared as ISO-8859-1 -->
<?xml version="1.0" encoding="ISO-8859-1"?>
<data>Special chars: 中文</data>  <!-- Won't display correctly -->

<!-- Solution: Match declaration with actual encoding -->
<?xml version="1.0" encoding="UTF-8"?>
<data>Special chars: 中文</data>  <!-- Correct -->
```

### 2. CDATA Misuse

```xml
<!-- Problem: CDATA for simple text -->
<name><![CDATA[John Doe]]></name>  <!-- Unnecessary -->

<!-- Solution: Use CDATA only when needed -->
<name>John Doe</name>

<!-- CDATA is useful here -->
<code><![CDATA[
    if (x < 5 && y > 10) {
        return true;
    }
]]></code>
```

### 3. Attribute vs Element

```xml
<!-- Attributes for metadata -->
<book id="123" isbn="978-0-123456-78-9">
    <title>XML Guide</title>
    <author>John Doe</author>
</book>

<!-- Elements for content -->
<book>
    <id>123</id>
    <title>XML Guide</title>
    <content>Full book text...</content>
</book>
```

---

## Quick Reference

| Rule                 | Priority   | Description                    | Fix                    |
| -------------------- | ---------- | ------------------------------ | ---------------------- |
| MissingEncoding      | Medium (3) | No encoding in XML declaration | Add `encoding="UTF-8"` |
| MistypedCDATASection | High (1)   | Incorrect CDATA syntax         | Use `<![CDATA[...]]>`  |

---
