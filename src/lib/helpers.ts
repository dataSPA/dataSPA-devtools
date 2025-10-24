import type { SSEEvent } from "$lib/types";

export function documentFragmentFromEvent(
  event: SSEEvent,
): DocumentFragment | null {
  if (!event) {
    return null;
  }
  if (!event.argsRaw) {
    return null;
  }
  if (!event.argsRaw.elements) {
    return null;
  }

  const detailContent = event.argsRaw.elements;
  const elementsWithSvgsRemoved = detailContent.replace(
    /<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim,
    "",
  );
  const hasHtml = /<\/html>/.test(elementsWithSvgsRemoved);
  const hasHead = /<\/head>/.test(elementsWithSvgsRemoved);
  const hasBody = /<\/body>/.test(elementsWithSvgsRemoved);

  const newDocument = new DOMParser().parseFromString(
    hasHtml || hasHead || hasBody
      ? detailContent
      : `<body><template>${detailContent}</template></body>`,
    "text/html",
  );
  let newContent = document.createDocumentFragment();
  if (hasHtml) {
    newContent.appendChild(newDocument.documentElement);
  } else if (hasHead && hasBody) {
    newContent.appendChild(newDocument.head);
    newContent.appendChild(newDocument.body);
  } else if (hasHead) {
    newContent.appendChild(newDocument.head);
  } else if (hasBody) {
    newContent.appendChild(newDocument.body);
  } else {
    newContent = newDocument.querySelector("template")!.content;
  }

  return newContent;
}

export function fragmentFromElements(elements: string) {
  const elementsWithSvgsRemoved = elements.replace(
    /<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim,
    "",
  );
  const hasHtml = /<\/html>/.test(elementsWithSvgsRemoved);
  const hasHead = /<\/head>/.test(elementsWithSvgsRemoved);
  const hasBody = /<\/body>/.test(elementsWithSvgsRemoved);

  const newDocument = new DOMParser().parseFromString(
    hasHtml || hasHead || hasBody
      ? elements
      : `<body><template>${elements}</template></body>`,
    "text/html",
  );
  let newContent = document.createDocumentFragment();
  if (hasHtml) {
    newContent.appendChild(newDocument.documentElement);
  } else if (hasHead && hasBody) {
    newContent.appendChild(newDocument.head);
    newContent.appendChild(newDocument.body);
  } else if (hasHead) {
    newContent.appendChild(newDocument.head);
  } else if (hasBody) {
    newContent.appendChild(newDocument.body);
  } else {
    newContent = newDocument.querySelector("template")!.content;
  }
  return newContent;
}
