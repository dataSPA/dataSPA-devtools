/**
 * Builds a collapsible HTML element tree from a raw HTML string.
 *
 * `buildHtmlTree` is intended for use in contexts with a real DOM (such as the
 * offscreen document) — it parses the input via DOMParser, constructs the
 * interactive ht-* tree, and serialises the result back to an HTML string so it
 * can be embedded directly in a `patch-elements` payload.
 *
 * Node types rendered:
 *   - Element nodes  — tag name + inline attributes, collapsible children
 *   - Text nodes     — text content (whitespace-only nodes are skipped)
 *   - Comment nodes  — <!-- ... -->
 *
 * Top-level nodes are expanded by default; children start collapsed.
 */

const TOGGLE_OPEN = "▼";
const TOGGLE_CLOSED = "▶";

function buildToggle(open: boolean): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "ht-toggle";
  btn.setAttribute("aria-label", open ? "collapse" : "expand");
  btn.textContent = open ? TOGGLE_OPEN : TOGGLE_CLOSED;
  btn.setAttribute(
    "data-on:click",
    `
    nowOpen = el.textContent === '${TOGGLE_OPEN}'
    el.textContent = nowOpen ? '${TOGGLE_CLOSED}' : '${TOGGLE_OPEN}      '
    el.setAttribute('aria-label', nowOpen ? 'expand' : 'collapse')
    parent = el.closest('.ht-node.ht-element')
    parent.querySelector('.ht-children').hidden = nowOpen
    parent.querySelector('.ht-line.ht-close-line').hidden = nowOpen
  `,
  );
  return btn;
}

function buildAttributeSpans(el: Element): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const attr of Array.from(el.attributes)) {
    const space = document.createElement("span");
    space.className = "ht-attr-sep";
    space.textContent = " ";
    frag.appendChild(space);

    const nameSpan = document.createElement("span");
    nameSpan.className = "ht-attr-name";
    nameSpan.textContent = attr.name;
    frag.appendChild(nameSpan);

    if (attr.value !== "") {
      const eq = document.createElement("span");
      eq.className = "ht-attr-eq";
      eq.textContent = "=";
      frag.appendChild(eq);

      const valSpan = document.createElement("span");
      valSpan.className = "ht-attr-value";
      // textContent assignment is always safe — the browser will never
      // interpret these characters as HTML. We add the surrounding quotes
      // as literal characters so they appear in the display.
      valSpan.textContent = `"${attr.value}"`;
      frag.appendChild(valSpan);
    }
  }
  return frag;
}

/**
 * Build a single DOM node's tree representation.
 *
 * @param node     The DOM node to represent
 * @param depth    Current nesting depth (0 = top-level; controls default open state)
 */
function buildNode(node: Node, depth: number): HTMLElement | null {
  // --- Element node ---
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tagName = el.tagName.toLowerCase();
    const children = Array.from(el.childNodes);
    const hasChildren = children.length > 0;

    const wrapper = document.createElement("div");
    wrapper.className = "ht-node ht-element";

    // Open line: [toggle] <tagname attrs>
    const openLine = document.createElement("div");
    openLine.className = "ht-line ht-open-line";

    // Build children container and close line up front so the toggle closure
    // can reference them regardless of declaration order.
    const isOpen = hasChildren && depth === 0;
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "ht-children";
    const closeLine = document.createElement("div");
    closeLine.className = "ht-line ht-close-line";

    if (hasChildren) {
      const toggle = buildToggle(isOpen);
      // toggle.addEventListener("click", (e) => {
      //   e.stopPropagation();
      //   const nowOpen = toggle.textContent === TOGGLE_OPEN;
      //   toggle.textContent = nowOpen ? TOGGLE_CLOSED : TOGGLE_OPEN;
      //   toggle.setAttribute("aria-label", nowOpen ? "expand" : "collapse");
      //   childrenContainer.hidden = nowOpen;
      //   closeLine.hidden = nowOpen;
      // });
      openLine.appendChild(toggle);
    } else {
      // Spacer keeps indentation consistent for leaf elements
      const spacer = document.createElement("span");
      spacer.className = "ht-toggle-spacer";
      openLine.appendChild(spacer);
    }

    const openTag = document.createElement("span");
    openTag.className = "ht-tag";
    const openBracket = document.createElement("span");
    openBracket.className = "ht-punct";
    openBracket.textContent = "<";
    const tagNameSpan = document.createElement("span");
    tagNameSpan.className = "ht-tag-name";
    tagNameSpan.textContent = tagName;
    openTag.appendChild(openBracket);
    openTag.appendChild(tagNameSpan);
    openTag.appendChild(buildAttributeSpans(el));

    const closePunct = document.createElement("span");
    closePunct.className = "ht-punct";
    closePunct.textContent = ">";
    openTag.appendChild(closePunct);

    openLine.appendChild(openTag);
    wrapper.appendChild(openLine);

    if (hasChildren) {
      childrenContainer.hidden = !isOpen;

      for (const child of children) {
        const childNode = buildNode(child, depth + 1);
        if (childNode) childrenContainer.appendChild(childNode);
      }
      wrapper.appendChild(childrenContainer);

      // Closing tag line
      closeLine.hidden = !isOpen;
      const spacer = document.createElement("span");
      spacer.className = "ht-toggle-spacer";
      closeLine.appendChild(spacer);
      const closeTag = document.createElement("span");
      closeTag.className = "ht-tag";
      const p1 = document.createElement("span");
      p1.className = "ht-punct";
      p1.textContent = "</";
      const tn = document.createElement("span");
      tn.className = "ht-tag-name";
      tn.textContent = tagName;
      const p2 = document.createElement("span");
      p2.className = "ht-punct";
      p2.textContent = ">";
      closeTag.appendChild(p1);
      closeTag.appendChild(tn);
      closeTag.appendChild(p2);
      closeLine.appendChild(closeTag);
      wrapper.appendChild(closeLine);
    }

    return wrapper;
  }

  // --- Text node ---
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").trim();
    if (text === "") return null; // skip whitespace-only text nodes

    const wrapper = document.createElement("div");
    wrapper.className = "ht-node ht-text";

    const line = document.createElement("div");
    line.className = "ht-line";

    const spacer = document.createElement("span");
    spacer.className = "ht-toggle-spacer";
    line.appendChild(spacer);

    const content = document.createElement("span");
    content.className = "ht-text-content";
    content.textContent = text;
    line.appendChild(content);

    wrapper.appendChild(line);
    return wrapper;
  }

  // --- Comment node ---
  if (node.nodeType === Node.COMMENT_NODE) {
    const text = node.textContent ?? "";

    const wrapper = document.createElement("div");
    wrapper.className = "ht-node ht-comment";

    const line = document.createElement("div");
    line.className = "ht-line";

    const spacer = document.createElement("span");
    spacer.className = "ht-toggle-spacer";
    line.appendChild(spacer);

    const content = document.createElement("span");
    content.className = "ht-comment-content";
    content.textContent = `<!--${text}-->`;
    line.appendChild(content);

    wrapper.appendChild(line);
    return wrapper;
  }

  return null;
}

function prettyHTML(node, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    return text ? `${pad}${text}\n` : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName.toLowerCase();
  const attrs = [...node.attributes]
    .map((a) => ` ${a.name}="${a.value}"`)
    .join("");

  const children = [...node.childNodes]
    .map((child) => prettyHTML(child, indent + 1))
    .join("\n");

  if (!children.trim()) return `${pad}<${tag}${attrs} />\n`;

  return `${pad}<${tag}${attrs}>\n${children}${pad}</${tag}>\n`;
}

export function buildHtmlTree(htmlString: string): string {
  if (!htmlString.trim()) {
    const empty = document.createElement("span");
    empty.className = "ht-empty";
    empty.textContent = "(empty)";
    return empty.outerHTML;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const topNodes = Array.from(doc.body.childNodes);

  let ret = "";
  for (const node of topNodes) {
    ret += prettyHTML(node, 0);
  }
  return ret;
}
