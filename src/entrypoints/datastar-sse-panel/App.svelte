<script module lang="ts">
    declare const chrome: any;
</script>

<script lang="ts">
    import ElementViewer from "./ElementViewer.svelte";
    import { Pane, Splitpanes } from "svelte-splitpanes";
    import { sseMessages } from "$lib/stores";
    import { port } from "./main";
    import type { SSEEvent } from "$lib/types";

    import { createHighlightToggleStore } from "../../lib/stores";
    import { derived } from "svelte/store";

    // const port = browser.runtime.connect({ name: "dataSPAdevtools" });

    onMount(() => {
        port.onMessage.addListener((msg) => {
            console.log(
                "I'm the SSE Panel. I got a message from background:",
                JSON.parse(msg.data),
            );
        });
    });

    function highlightSelectors(selectors: string[]) {
        port.postMessage({
            tabId: browser.devtools.inspectedWindow.tabId,
            action: "highlightSelectors",
            data: selectors,
        });
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

    let highlightToggle = createHighlightToggleStore();
    let showing = $state(false);
    let currentEvent = $state({} as SSEEvent);

    function closePane() {
        showing = false;
    }

    function removeHighlights() {
        port.postMessage({
            tabId: browser.devtools.inspectedWindow.tabId,
            action: "removeHighlights",
        });
    }

    function getSelector(event: any) {
        if (event.argsRaw && event.argsRaw.selector) {
            return [event.argsRaw.selector];
        }

        let selectors = [];

        const doc = fragmentForEvent(event);
        if (!doc) {
            return [];
        }

        for (const child of doc.children) {
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
    }

    function fragmentFromElements(elements: string) {
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

    function fragmentForEvent(event: SSEEvent) {
        if (!event.argsRaw || !event.argsRaw.elements) {
            return;
        }

        const elements = event.argsRaw.elements;

        return fragmentFromElements(elements);
    }

    let detailContent = $state("");
    let detailDocument = $derived.by(() => {
        return fragmentFromElements(detailContent);
    });
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
                                            currentEvent = event;
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
                                                    {#if event.argsRaw}
                                                        {#if event.argsRaw.elements}
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
                                                        {/if}
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
                    highlightSelectors={() =>
                        highlightSelectors(getSelector(currentEvent))}
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
