<script module lang="ts">
    declare const chrome: any;
</script>

<script lang="ts">
    import ElementViewer from "./ElementViewer.svelte";
    import { Pane, Splitpanes } from "svelte-splitpanes";
    import { sseMessages } from "$lib/stores";
    import type { SSEEvent } from "$lib/types";

    import { createHighlightToggleStore } from "../../lib/stores";
    import { derived } from "svelte/store";

    const port = browser.runtime.connect({ name: "dataSPAdevtools" });

    port.onMessage.addListener((msg) => {
        console.log(
            "I'm the SSE Panel. I got a message from background:",
            JSON.parse(msg.data),
        );
    });

    function highlightSelectors(selectors: string[]) {
        for (const selector of selectors) {
            if (selector === "DOCUMENT") {
                continue; // TODO
            } else if (selector === "BODY") {
                continue; // TODO
            } else if (selector === "HEAD") {
                continue; // TODO
            } else {
                chrome.devtools.inspectedWindow.eval(
                    `
        (function() {
          var el = document.querySelector('${selector}');
          if (!el) return "Element not found";

          // Inject CSS once
          if (!document.getElementById("___myHighlightStyle")) {
            var style = document.createElement("style");
            style.id = "___myHighlightStyle";
            style.textContent = \`
              .___myHighlight {
                outline: 3px solid magenta !important;
                outline-offset: -3px !important;
              }
            \`;
            document.head.appendChild(style);
          }

          // Apply highlight class
          el.classList.add("___myHighlight");

          return "Highlighted " + "${selector}";
        })();
      `,
                    (result: any, exceptionInfo: any) => {
                        if (exceptionInfo && exceptionInfo.isException) {
                            console.error("Eval failed:", exceptionInfo);
                        } else {
                            console.log("Result:", result);
                        }
                    },
                );
            }
        }
    }

    function documentFragmentFromEvent(
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

    // let storeA = createStore<any[]>([], "session:sseEvents");
    // let sseEvents = derived(storeA, ($s) => $s);
    let highlightToggle = createHighlightToggleStore();
    let showing = $state(false);

    // let selectors: string[] = [];

    function closePane() {
        showing = false;
    }

    function removeHighlights() {
        chrome.devtools.inspectedWindow.eval(
            `
        (function() {
          var els = document.querySelectorAll('.___myHighlight');
          if (!els) return "Element not found";

          for (const el of els) {
            el.classList.remove("___myHighlight");
          }

          // If no elements are using the class, remove the style tag
          if (!document.querySelector(".___myHighlight")) {
            var style = document.getElementById("___myHighlightStyle");
            if (style) style.remove();
          }

          return "Removed highlights";
        })();
      `,
            (result: any, exceptionInfo: any) => {
                if (exceptionInfo && exceptionInfo.isException) {
                    console.error("Eval failed:", exceptionInfo);
                } else {
                    console.log("Result:", result);
                }
            },
        );
    }

    // Automatic highlight function for SSE events
    function autoHighlightSelectors(selectors: string[]) {
        // Remove existing highlights first
        removeHighlights();

        // Highlight new selectors
        for (const selector of selectors) {
            if (
                selector === "DOCUMENT" ||
                selector === "BODY" ||
                selector === "HEAD"
            ) {
                continue; // TODO
            } else {
                chrome.devtools.inspectedWindow.eval(
                    `
        (function() {
          var el = document.querySelector('${selector}');
          if (!el) return "Element not found";

          // Inject CSS once
          if (!document.getElementById("___myHighlightStyle")) {
            var style = document.createElement("style");
            style.id = "___myHighlightStyle";
            style.textContent = \`
              .___myHighlight {
                outline: 3px solid magenta !important;
                outline-offset: -3px !important;
              }
            \`;
            document.head.appendChild(style);
          }

          // Apply highlight class
          el.classList.add("___myHighlight");

          return "Highlighted " + "${selector}";
        })();
      `,
                    (result: any, exceptionInfo: any) => {
                        if (exceptionInfo && exceptionInfo.isException) {
                            console.error("Eval failed:", exceptionInfo);
                        } else {
                            console.log("Result:", result);
                        }
                    },
                );
            }
        }
    }

    // let highlightTarget = async () => {
    //     for (const selector of selectors) {
    //         if (selector === "DOCUMENT") {
    //             chrome.devtools.inspectedWindow.eval(
    //                 `console.log("replacing document");`,
    //             );
    //         } else if (selector === "BODY") {
    //             chrome.devtools.inspectedWindow.eval(
    //                 `console.log("replacing body");`,
    //             );
    //         } else if (selector === "HEAD") {
    //             chrome.devtools.inspectedWindow.eval(
    //                 `console.log("replacing head");`,
    //             );
    //         } else {
    //             chrome.devtools.inspectedWindow.eval(
    //                 `console.log("replacing element", document.getElementById("${selector}"));`,
    //             );
    //         }
    //     }
    // };

    let getSelector = (event: any) => {
        if (event.argsRaw && event.argsRaw.selector) {
            return [event.argsRaw.selector];
        }

        let selectors = [];

        for (const child of detailDocument.children) {
            if (child instanceof HTMLHtmlElement) {
                selectors.push("DOCUMENT");
            } else if (child instanceof HTMLBodyElement) {
                selectors.push("BODY");
            } else if (child instanceof HTMLHeadElement) {
                selectors.push("HEAD");
            } else {
                selectors.push(`#${child.id}`);
            }
        }

        return selectors;
    };

    let detailContent = $state("");
    let detailDocument = $derived.by(() => {
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
    });

    // Subscribe to SSE events and automatically highlight if enabled
    // sseEvents.subscribe((events: any[]) => {
    //     // Check if highlight toggle is enabled
    //     highlightToggle.subscribe((enabled: boolean) => {
    //         if (enabled && events.length > 0) {
    //             // Get the latest event
    //             const latestEvent = events[events.length - 1];
    //             if (
    //                 latestEvent.type != "started" &&
    //                 latestEvent.type != "finished" &&
    //                 latestEvent.argsRaw &&
    //                 latestEvent.argsRaw.selector
    //             ) {
    //                 // Automatically highlight the selector
    //                 autoHighlightSelectors([latestEvent.argsRaw.selector]);
    //             }
    //         }
    //     });
    // });
</script>

<div class="h-screen">
    <Splitpanes horizontal={true}>
        <Pane>
            <div>
                <div>
                    <h2>SSE Events</h2>
                    <div>
                        <label for="highlight-toggle">Highlight Elements</label>
                        <input
                            id="highlight-toggle"
                            type="checkbox"
                            bind:checked={$highlightToggle}
                        />
                    </div>
                </div>
                <table>
                    <colgroup>
                        <col />
                        <col />
                        <col />
                        <col />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Selector</th>
                            <th>Mode</th>
                            <th>Elements/Signals</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each $sseMessages as event}
                            {#if event.type != "started" && event.type != "finished"}
                                <tr
                                    onclick={() => {
                                        removeHighlights();
                                        if (!showing) {
                                            showing = true;
                                        }
                                        if (
                                            event.argsRaw &&
                                            event.argsRaw.elements
                                        ) {
                                            detailContent =
                                                event.argsRaw.elements;
                                        } else {
                                            // selectors = [""];
                                            detailContent = "";
                                        }
                                    }}
                                >
                                    <td>
                                        {#if event.type == "datastar-patch-elements"}
                                            elements
                                        {:else if event.type == "datastar-patch-signals"}
                                            signals
                                        {:else}
                                            {event.type}
                                        {/if}
                                    </td>
                                    {#if event.argsRaw}
                                        {#if event.type == "datastar-patch-elements"}
                                            <td>
                                                {getSelector(event).join(", ")}
                                            </td>
                                            <td>
                                                {event.argsRaw.mode}
                                            </td>
                                            <td>
                                                <span>
                                                    {#if event.argsRaw.elements.trim().length > 50}
                                                        {event.argsRaw.elements
                                                            .trim()
                                                            .substring(
                                                                0,
                                                                50,
                                                            )}&hellip;
                                                    {:else}
                                                        {event.argsRaw.elements.trim()}
                                                    {/if}
                                                </span>
                                            </td>
                                        {:else}
                                            <td>&nbsp;</td>
                                            <td>&nbsp;</td>
                                            <td>&nbsp;</td>
                                        {/if}
                                    {/if}
                                </tr>
                            {/if}
                        {/each}
                    </tbody>
                </table>
            </div>
        </Pane>
        {#if showing}
            <Pane minSize={20}>
                <ElementViewer
                    {detailDocument}
                    {closePane}
                    {highlightSelectors}
                />
            </Pane>
        {/if}
    </Splitpanes>
</div>

<style>
    ul {
        /*@apply list-disc list-inside;*/
        padding-left: 1rem;
    }
</style>
