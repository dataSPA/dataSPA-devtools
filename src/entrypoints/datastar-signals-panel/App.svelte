<script lang="ts">
    import svelteLogo from "../../assets/svelte.svg";
    import Counter from "../../lib/Counter.svelte";
    import { createStore } from "../../lib/store";
    import { derived } from "svelte/store";

    let storeA = createStore("{}", "session:signals");
    let signals = derived(storeA, ($s) => JSON.parse($s));
</script>

<main>
    <h2>Signals</h2>
    {#snippet treeNode(node)}
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
        {#each Object.entries($signals) as [key, value]}
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
