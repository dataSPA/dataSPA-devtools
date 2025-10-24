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
    import { fragmentFromElements } from "$lib/helpers";
    import { derived } from "svelte/store";
    import EventRow from "./EventRow.svelte";

    function highlightSelectors(selectors: string[]) {
        port.postMessage({
            tabId: browser.devtools.inspectedWindow.tabId,
            action: "highlightSelectors",
            data: selectors,
        });
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
                            <EventRow
                                {event}
                                {index}
                                {getSelector}
                                {selectEvent}
                            />
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
                        {currentEvent}
                        {port}
                        highlightSelectors={() =>
                            highlightSelectors(getSelector(currentEvent))}
                    />
                </div>
            </Pane>
        {/if}
    </Splitpanes>
</div>

<style>
    :global(body) {
        margin: 0;
        background-color: light-dark(white, grey);
    }
    .events-container {
        overflow-y: scroll;
        height: 100%;
    }

    .events {
        display: grid;
        margin-top: 5px;
        /*gap: 5px;*/
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
</style>
