type DSFetchEvent = CustomEvent<{
  detail: { el: HTMLElement; rawArgs: string };
}>;

function getElementSelector(element: HTMLElement) {
  if (element.id) {
    return `#${element.id}`;
  }
  if (element.tagName === "BODY") {
    return "body";
  }
  let selector = element.tagName.toLowerCase();
  if (element.className) {
    selector += `.${element.className.replace(/ /g, ".")}`;
  }
  if (element.parentNode) {
    let siblings = Array.from(element.parentNode.children);
    let index = siblings.indexOf(element) + 1;
    if (siblings.length > 1) {
      selector += `:nth-child(${index})`;
    }
  }
  return selector;
}

function getUniqueSelector(element: HTMLElement) {
  let selector = getElementSelector(element);
  let elements = document.querySelectorAll(selector);

  if (elements.length === 1) {
    return selector;
  }

  let bestSelector = selector;
  let bestCount = elements.length;

  // Try with parents' ids
  let parent = element.parentElement;
  while (parent) {
    if (parent.id) {
      let parentSelector = `#${parent.id} ${selector}`;
      elements = document.querySelectorAll(parentSelector);
      if (elements.length === 1) {
        return parentSelector;
      }
      if (elements.length < bestCount) {
        bestSelector = parentSelector;
        bestCount = elements.length;
      }
    }
    parent = parent.parentElement;
  }

  // Try with parents' classes
  let parentClasses = [];
  parent = element.parentElement;
  while (parent && parent.tagName !== "BODY") {
    let classes: string[] = Array.from(parent.classList).filter(
      (c) => !parentClasses.includes(c),
    );
    for (let i = 0; i < classes.length; i++) {
      let parentSelector = `.${classes[i]} ${selector}`;
      elements = document.querySelectorAll(parentSelector);
      if (elements.length === 1) {
        return parentSelector;
      }
      if (elements.length < bestCount) {
        bestSelector = parentSelector;
        bestCount = elements.length;
      }
      parentClasses.push(classes[i]);
    }
    parent = parent.parentElement;
  }

  // Try with all parents
  parent = element.parentElement;
  let selectors = [selector];
  while (parent && parent.tagName !== "BODY") {
    let newSelectors = [];
    for (let i = 0; i < selectors.length; i++) {
      let newSelector = `${parent.tagName.toLowerCase()} ${selectors[i]}`;
      newSelectors.push(newSelector);
      elements = document.querySelectorAll(newSelector);
      if (elements.length === 1) {
        return newSelector;
      }
      if (elements.length < bestCount) {
        bestSelector = newSelector;
        bestCount = elements.length;
      }
    }
    selectors = newSelectors;
    parent = parent.parentElement;
  }

  return bestSelector;
}

export default defineUnlistedScript(() => {
  document.addEventListener("datastar-fetch", (event) => {
    const element = (event as DSFetchEvent).detail.el;
    const elementSelector = getUniqueSelector(element);
    window.postMessage(
      {
        type: "datastar-fetch",
        el: elementSelector,
        data: JSON.stringify((event as DSFetchEvent).detail),
      },
      "*",
    );
  });
});
