<script module lang="ts">
    declare const chrome: any;
</script>

<script lang="ts">
    import CodeXml from "@lucide/svelte/icons/code-xml";
    import Radio from "@lucide/svelte/icons/radio";
    let { event, index, getSelector, selectEvent } = $props();
</script>

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
            <div class="element-code">
                {#if event.argsRaw}
                    {#if event.argsRaw.elements}
                        {#if event.argsRaw.elements.trim().length > 50}
                            {event.argsRaw.elements
                                .trim()
                                .substring(0, 50)}&hellip;
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
<div class="event-row"><hr /></div>

<style>
    .element-code {
        font-family:
            ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas,
            "DejaVu Sans Mono", monospace;
    }
    .event-row div {
        align-content: center;
        /*height: 1rem;*/
    }
    .event-row {
        display: grid;
        grid-template-columns: subgrid;
        grid-column: span 4;
        cursor: pointer;
        gap: 10px;
    }
    .event-row hr {
        grid-column: 1/-1;
        border-bottom: solid 0.5px grey;
        margin: 0;
        width: 100%;
    }
</style>
