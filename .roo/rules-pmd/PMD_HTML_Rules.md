# PMD HTML Rules

## Overview

## Follow these PMD (Programming Mistake Detector) rules when analyzing or generating HTML markup. PMD is a static code analyzer that identifies common issues in HTML.

## Best Practices

### 1. AvoidInlineStyles

**Priority:** Medium (3)

**Rule:**  
Don't mix content and style. Use separate CSS files for styling and introduce classes.

**Purpose:**  
This helps maintain separation of concerns and improves maintainability. Inline styles create several problems:

- Difficult to maintain across multiple pages
- Cannot be reused
- Harder to override or customize
- Increases HTML file size
- Violates separation of concerns principle

**Example Violation:**

```html
<div style="color: red; font-size: 14px;">This text has inline styles</div>
```

**Correct Approach:**

```html
<!-- HTML file -->
<div class="error-text">This text uses CSS classes</div>

<!-- CSS file -->
.error-text { color: red; font-size: 14px; }
```

**Benefits of External CSS:**

- Centralized style management
- Better browser caching
- Easier theme changes
- Improved code reusability
- Better collaboration between designers and developers

---

### 2. UnnecessaryTypeAttribute

**Priority:** Low (5)

**Rule:**  
In HTML5, the explicit type attribute for link and script elements is not needed.

**Purpose:**  
Modern browsers automatically recognize these elements without explicit type declarations.

- HTML5 defaults to CSS for `<link>` tags and JavaScript for `<script>` tags
- The type attribute is redundant in modern HTML
- Cleaner, more concise markup
- Follows current web standards

**Example Violations:**

```html
<!-- Unnecessary type attribute on link -->
<link rel="stylesheet" type="text/css" href="styles.css" />

<!-- Unnecessary type attribute on script -->
<script type="text/javascript" src="app.js"></script>
```

**Correct HTML5 Approach:**

```html
<!-- Clean HTML5 syntax -->
<link rel="stylesheet" href="styles.css" />

<script src="app.js"></script>
```

**Note:** The type attribute is still useful in specific cases:

- Non-standard script types: `<script type="module">`
- Alternative stylesheets: `<link rel="alternate stylesheet">`
- Custom data types

---

### 3. UseAltAttributeForImages

**Priority:** High (1)

**Rule:**  
Always use an "alt" attribute for images.

**Purpose:**  
This provides alternative text and is extensively used by screen readers for accessibility. Alt text is also displayed when images fail to load.

The alt attribute is crucial for:

- **Accessibility:** Screen readers use alt text to describe images to visually impaired users
- **SEO:** Search engines index alt text to understand image content
- **Fallback:** Text displays when images don't load due to network issues
- **Context:** Helps users understand the purpose of the image
- **Legal Compliance:** Required by accessibility laws (WCAG, ADA, Section 508)

**Example Violations:**

```html
<!-- Missing alt attribute -->
<img src="logo.png" />

<!-- Empty alt without justification -->
<img src="decorative.png" alt="" />
```

**Correct Approach:**

```html
<!-- Meaningful alt text -->
<img src="company-logo.png" alt="Acme Corporation Logo" />

<!-- Descriptive alt for content images -->
<img src="chart.png" alt="Sales growth chart showing 25% increase in Q3 2024" />

<!-- Empty alt for purely decorative images (with role="presentation") -->
<img src="decorative-border.png" alt="" role="presentation" />

<!-- Alt text for functional images -->
<img src="search-icon.png" alt="Search" />
```

**Best Practices for Alt Text:**

1. **Be Descriptive:** Describe what the image shows, not just its file name

    - Bad: `alt="IMG_1234"`
    - Good: `alt="Golden retriever playing fetch in the park"`

2. **Keep it Concise:** Aim for 125 characters or less

    - Screen readers may cut off longer descriptions

3. **Avoid Redundancy:** Don't start with "Image of" or "Picture of"

    - Bad: `alt="Image of a sunset"`
    - Good: `alt="Sunset over mountain landscape"`

4. **Context Matters:** Alt text should fit the context

    - For a product image: `alt="iPhone 15 Pro in titanium finish"`
    - For a button: `alt="Add to cart"`

5. **Decorative Images:** Use empty alt (`alt=""`) for purely decorative images

    - Prevents screen readers from announcing irrelevant images

6. **Complex Images:** For charts, graphs, or diagrams, provide:
    - Brief alt text
    - Detailed description in nearby text or via aria-describedby

**Example for Complex Images:**

```html
<figure>
	<img src="sales-chart.png" alt="Annual sales chart" aria-describedby="chart-description" />
	<figcaption id="chart-description">
		Sales increased from $1M in Q1 to $2.5M in Q4, showing steady quarterly growth of approximately 20%.
	</figcaption>
</figure>
```

**WCAG Requirements:**

- **Level A (Required):** Non-text content must have a text alternative
- **Level AA:** Images of text should be avoided when possible
- **Level AAA:** Provide extended descriptions for complex images

---

## HTML5 Standards Compliance

### Modern HTML Best Practices

1. **Use Semantic HTML:**

    ```html
    <!-- Good -->
    <article>
    	<header>
    		<h1>Article Title</h1>
    	</header>
    	<section>
    		<p>Content here</p>
    	</section>
    </article>

    <!-- Avoid -->
    <div class="article">
    	<div class="header">
    		<div class="title">Article Title</div>
    	</div>
    </div>
    ```

2. **Minimize Inline Attributes:**

    - Move styles to CSS
    - Move behavior to JavaScript
    - Keep HTML focused on structure

3. **Accessibility First:**
    - Always include alt attributes
    - Use ARIA labels when needed
    - Ensure keyboard navigation
    - Maintain proper heading hierarchy

---

## Common HTML Anti-Patterns to Avoid

### 1. Inline Styles Everywhere

```html
<!-- Bad -->
<div style="margin: 10px; padding: 5px; background: blue;">
	<span style="color: white; font-size: 14px;">Text</span>
</div>
```

### 2. Missing Semantic Structure

```html
<!-- Bad -->
<div class="nav">
	<div class="nav-item">Home</div>
</div>

<!-- Good -->
<nav>
	<a href="/">Home</a>
</nav>
```

### 3. Inaccessible Images

```html
<!-- Bad -->
<img src="important-chart.png" />

<!-- Good -->
<img src="important-chart.png" alt="Sales performance chart showing 30% increase in Q4" />
```

### 4. Non-Standard Attributes

```html
<!-- Bad -->
<div custom-data="value">Content</div>

<!-- Good -->
<div data-custom="value">Content</div>
```

---

## Benefits of Following PMD HTML Rules

1. **Improved Accessibility:** More users can access your content
2. **Better SEO:** Search engines better understand your content
3. **Maintainability:** Cleaner, more organized code
4. **Performance:** Smaller file sizes with external CSS
5. **Standards Compliance:** Follows modern HTML5 standards
6. **Legal Protection:** Meets accessibility requirements
7. **User Experience:** Faster load times, better readability

---

## Quick Reference

| Rule                     | Priority   | Description                               |
| ------------------------ | ---------- | ----------------------------------------- |
| AvoidInlineStyles        | Medium (3) | Use external CSS instead of inline styles |
| UnnecessaryTypeAttribute | Low (5)    | Remove redundant type attributes in HTML5 |
| UseAltAttributeForImages | High (1)   | Always provide alt text for images        |

---
