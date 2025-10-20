<script lang="ts">
    import svelteLogo from "../../assets/svelte.svg";
    import Counter from "../../lib/Counter.svelte";
    import { signalMessages } from "$lib/stores";
    import { derived } from "svelte/store";

    // let signals = derived(storeA, ($s) => JSON.parse($s));
</script>

<main>
    <h2>Signals</h2>
    {#snippet treeNode(node: object)}
        <ul>
            {#each Object.entries(node) as [key, value]}
                <li>
                    {#if typeof value === "object"}
                        {@render treeNode(value)}
                    {:else}
                        {key}: {JSON.stringify(value)}
                    {/if}
                </li>
            {/each}
        </ul>
    {/snippet}
    <ul>
        {#each Object.entries($signalMessages) as [key, value]}
            <li>
                {key}:
                {#if typeof value === "object"}
                    {@render treeNode(value)}
                {:else}
                    {JSON.stringify(value)}
                {/if}
            </li>
        {/each}
    </ul>
</main>

<style>
    main {
        margin: 0 auto;
        padding: 2rem;
    }
</style>
