<script module lang="ts">
    declare const chrome: any;
</script>

<script lang="ts">
    import ElementViewer from "./ElementViewer.svelte";
    import { Pane, Splitpanes } from "svelte-splitpanes";
    import { sseMessages } from "$lib/stores";
    import CodeXml from "@lucide/svelte/icons/code-xml";
    import Radio from "@lucide/svelte/icons/radio";
    import { port } from "./main";
    import type { DSFetchDetail, SSEEvent } from "$lib/types";

    import { createHighlightToggleStore } from "../../lib/stores";
    import { derived } from "svelte/store";

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
    function selectEvent(event: SSEEvent) {
        removeHighlights();
        if (!showing) {
            showing = true;
        }
        if (event.argsRaw && event.argsRaw.elements) {
            detailContent = event.argsRaw.elements;
            currentEvent = event;
        } else {
            detailContent = "";
        }
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

<div class="container">
    <header>
        <label for="highlight-toggle">Highlight Elements</label>
        <input
            id="highlight-toggle"
            type="checkbox"
            bind:checked={$highlightToggle}
        />
    </header>
    <Splitpanes horizontal={true}>
        <Pane>
            <div class="events-container">
                <div class="events">
                    {#each $sseMessages as event, index}
                        {#if event.type != "started" && event.type != "finished"}
                            <div
                                class="event-row"
                                tabindex={index}
                                role="row"
                                onkeydown={() => {
                                    selectEvent(event);
                                }}
                                onclick={() => {
                                    selectEvent(event);
                                }}
                            >
                                <div>
                                    {#if event.type == "datastar-patch-elements"}
                                        <CodeXml />
                                    {:else if event.type == "datastar-patch-signals"}
                                        <Radio />
                                    {:else}
                                        {event.type}
                                    {/if}
                                </div>
                                {#if event.argsRaw}
                                    {#if event.type == "datastar-patch-elements"}
                                        <div>
                                            {getSelector(event).join(", ")}
                                        </div>
                                        <div>
                                            {event.argsRaw.mode}
                                        </div>
                                        <div>
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
                                        </div>
                                    {:else}
                                        <div>&nbsp;></div>
                                    {/if}
                                {/if}
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>
        </Pane>
        {#if showing}
            <Pane>
                <div class="details">
                    <ElementViewer
                        {detailDocument}
                        {closePane}
                        highlightSelectors={() =>
                            highlightSelectors(getSelector(currentEvent))}
                    />
                </div>
            </Pane>
        {/if}
    </Splitpanes>
</div>

<style>
    .event-row {
        display: contents;
        cursor: pointer;
    }
    .events-container {
        overflow-y: scroll;
        height: 100%;
    }

    .events {
        display: grid;
        margin-top: 5px;
        gap: 5px;
        grid-template-columns: repeat(4, max-content);
        grid-auto-rows: max-content;
    }

    .container {
        height: 100vh;
    }
    header {
        position: sticky;
        top: 0;
        left: 0;
        background-color: #fff;
        padding: 5px;
        margin: 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        height: min-content;
    }
    /*.details {
        min-height: 50cqh;
    }*/
</style>
