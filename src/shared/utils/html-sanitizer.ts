// src/shared/utils/html-sanitizer.ts
/**
 * Safe HTML sanitizer for clipboard content
 * Removes potentially dangerous elements and attributes
 */

const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img',
    'table', 'tr', 'td', 'th', 'tbody', 'thead',
    'blockquote', 'pre', 'code'
];

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
    'a': ['href', 'title'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'span': ['style'],
    'div': ['style'],
    'p': ['style']
};

const DANGEROUS_PROTOCOLS = [
    'javascript:', 'vbscript:', 'data:', 'file:', 'ftp:'
];

export class HTMLSanitizer {
    /**
     * Sanitize HTML content by removing dangerous elements and attributes
     */
    static sanitize(html: string): string {
        // Create a temporary document for parsing
        const doc = new DOMParser().parseFromString(html, 'text/html');

        // Recursively clean the document
        this.cleanNode(doc.body);

        return doc.body.innerHTML;
    }

    /**
     * Clean a DOM node recursively
     */
    private static cleanNode(node: Element): void {
        // Process all child nodes
        const children = Array.from(node.children);

        for (const child of children) {
            const tagName = child.tagName.toLowerCase();

            // Remove dangerous tags entirely
            if (!ALLOWED_TAGS.includes(tagName)) {
                // Keep text content but remove the tag
                const textContent = child.textContent || '';
                const textNode = document.createTextNode(textContent);
                child.parentNode?.replaceChild(textNode, child);
                continue;
            }

            // Clean attributes
            this.cleanAttributes(child);

            // Recursively clean children
            this.cleanNode(child);
        }
    }

    /**
     * Remove dangerous attributes from an element
     */
    private static cleanAttributes(element: Element): void {
        const tagName = element.tagName.toLowerCase();
        const allowedAttrs = ALLOWED_ATTRIBUTES[tagName] || [];

        // Get all attributes
        const attributes = Array.from(element.attributes);

        for (const attr of attributes) {
            const attrName = attr.name.toLowerCase();

            // Remove event handlers
            if (attrName.startsWith('on')) {
                element.removeAttribute(attr.name);
                continue;
            }

            // Remove non-allowed attributes
            if (!allowedAttrs.includes(attrName)) {
                element.removeAttribute(attr.name);
                continue;
            }

            // Check for dangerous protocols in URLs
            if (['href', 'src'].includes(attrName)) {
                const value = attr.value.toLowerCase().trim();
                if (DANGEROUS_PROTOCOLS.some(protocol => value.startsWith(protocol))) {
                    element.removeAttribute(attr.name);
                    continue;
                }
            }

            // Sanitize style attributes
            if (attrName === 'style') {
                const safeStyle = this.sanitizeStyle(attr.value);
                if (safeStyle) {
                    element.setAttribute(attr.name, safeStyle);
                } else {
                    element.removeAttribute(attr.name);
                }
            }
        }
    }

    /**
     * Sanitize CSS styles
     */
    private static sanitizeStyle(style: string): string {
        const dangerous = [
            'expression', 'javascript:', 'vbscript:', 'behavior:', 'binding:',
            '@import', 'url('
        ];

        const lowerStyle = style.toLowerCase();

        // Check for dangerous CSS
        if (dangerous.some(danger => lowerStyle.includes(danger))) {
            return '';
        }

        return style;
    }

    /**
     * Check if content appears to be safe HTML
     */
    static isSafeHTML(html: string): boolean {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // Check for script tags
            if (doc.querySelectorAll('script').length > 0) {
                return false;
            }

            // Check for dangerous attributes
            const allElements = doc.querySelectorAll('*');
            for (const element of allElements) {
                const attributes = Array.from(element.attributes);
                for (const attr of attributes) {
                    if (attr.name.startsWith('on') || attr.value.includes('javascript:')) {
                        return false;
                    }
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Simple text-only extraction from HTML
     */
    static extractText(html: string): string {
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return doc.body.textContent || '';
        } catch {
            return html.replace(/<[^>]*>/g, '');
        }
    }
}

// Convenience functions
export const sanitizeHTML = (html: string): string => HTMLSanitizer.sanitize(html);
export const isSafeHTML = (html: string): boolean => HTMLSanitizer.isSafeHTML(html);
export const extractTextFromHTML = (html: string): string => HTMLSanitizer.extractText(html);