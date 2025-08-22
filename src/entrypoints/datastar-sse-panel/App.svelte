<script lang="ts">
    import svelteLogo from "../../assets/svelte.svg";
    import Counter from "../../lib/Counter.svelte";
    import { createStore } from "../../lib/store";
    import { derived } from "svelte/store";

    let parser = new DOMParser();

    let storeA = createStore("[]", "session:sseEvents");
    let sseEvents = derived(storeA, ($s) => JSON.parse($s));
    let showing = $state(false);
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
</script>

<main>
    <div class="tableWrap">
        <table>
            <thead>
                <tr>
                    <th class="type">Type</th>
                    <th class="selector">Selector</th>
                    <th class="mode">Mode</th>
                    <th class="detailsCol">Elements/Signals</th>
                </tr>
            </thead>
            <tbody>
                {#each $storeA as event}
                    {#if event.type != "started" && event.type != "finished"}
                        <tr
                            onclick={() => {
                                if (!showing) {
                                    showing = true;
                                }
                                detailContent = event.argsRaw.elements;
                            }}
                        >
                            <td>
                                {#if event.type == "datastar-patch-elements"}
                                    patch
                                {:else if event.type == "datastar-patch-signals"}
                                    signals
                                {:else}
                                    {event.type}
                                {/if}
                            </td>
                            {#if event.argsRaw}
                                {#if event.type == "datastar-patch-elements"}
                                    <td>
                                        {event.argsRaw.selector}
                                    </td>
                                    <td>
                                        {event.argsRaw.mode}
                                    </td>
                                    <td>
                                        {event.argsRaw.elements}
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
    {#if showing}
        <div>
            <div class="bar">
                <span id="line"></span>
                <button
                    type="button"
                    id="close-button"
                    onclick={() => (showing = false)}
                >
                    X
                </button>
            </div>
            <div class="details">
                {#snippet treeNode(node)}
                    <ul>
                        {#each node.children as child}
                            <li>
                                {child.nodeName} - {child.children.length}
                                {@render treeNode(child)}
                            </li>
                        {/each}
                    </ul>
                {/snippet}
                <ul>
                    {#each detailDocument.children as child}
                        <li>
                            {child.nodeName} - {child.children.length}
                            {@render treeNode(child)}
                        </li>
                    {/each}
                </ul>
            </div>
        </div>
    {/if}
</main>

<style>
    .type,
    .mode,
    .selector {
        width: 15%;
        max-width: 15%;
    }
    .detailsCol {
        width: 55%;
        max-width: 55%;
    }
    li {
        text-align: left;
    }
    .tableWrap {
        overflow: auto;
    }
    .bar {
        display: flex;
        align-items: center;
    }
    #line {
        width: 95vw;
        height: 1px;
        background-color: white;
    }
    #close-button {
        padding: 0.2rem;
        margin: 0;
    }
    table {
        width: 100%;
    }

    table thead {
        position: sticky;
        top: 0;
        z-index: 2;
        background-color: #444;
    }
    td {
        padding: 0.25rem;
        padding-right: 1rem;
        text-align: left;
        text-overflow: ellipsis;
        width: 100%;
        overflow: hidden;
        white-space: nowrap;
    }
    tbody {
        display: block;
        overflow-y: scroll;
    }
    tr {
        display: table;
        text-align: left;
    }
    tr > td {
        width: 10rem;
    }
    main {
        display: flex;
        flex-direction: column;
        align-items: top;
        justify-content: left;
        height: 100vh;
    }
    .details {
        min-height: 50vh;
        max-height: 50vh;
        overflow-y: auto;
    }
</style>
