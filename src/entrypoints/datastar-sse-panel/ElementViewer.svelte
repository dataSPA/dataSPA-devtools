<script module lang="ts">
    declare const chrome: any;
</script>

<script lang="ts">
    import PanelBottomClose from "@lucide/svelte/icons/panel-bottom-close";
    import Crosshair from "@lucide/svelte/icons/crosshair";
    import { SvelteMap } from "svelte/reactivity";

    let { detailDocument, closePane, highlightSelectors } = $props();

    let nodeCollapsed = new SvelteMap();

    let toggleChild = (child: any) => {
        nodeCollapsed.set(child, !!!nodeCollapsed.get(child));
    };

    function attributeString(element: Element): string {
        let ret = Array.from(element.attributes)
            .map((attr) => `${attr.name}="${attr.value}"`)
            .join(" ");
        if (ret.length > 0) {
            return " " + ret;
        }
        return "";
    }

    let selectors: string[] = [];

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
</script>

<div>
    <div>
        <button onclick={() => highlightSelectors(selectors)}>
            <Crosshair />
            Show selector target</button
        >
        <button onclick={closePane}>
            <PanelBottomClose />
        </button>
    </div>
    <hr />
    <div>
        {#snippet treeNode(node: any)}
            <ul>
                {#each node.childNodes as child}
                    {#if child.nodeType === Node.TEXT_NODE}
                        {child.textContent}
                    {/if}
                {/each}
                {#each node.children as child}
                    <li>
                        <button
                            class={nodeCollapsed.get(child)
                                ? "cursor-pointer"
                                : "cursor-pointer inline-block rotate-90"}
                            onclick={() => toggleChild(child)}
                            >&#x25b6;
                        </button>
                        &lt;{child.nodeName.toLowerCase()}{attributeString(
                            child,
                        )}&gt;
                        {#if !nodeCollapsed.get(child)}
                            {@render treeNode(child)}
                            <span>
                                &lt;/{child.nodeName.toLowerCase()}&gt;
                            </span>
                        {/if}
                    </li>
                {/each}
            </ul>
        {/snippet}
        <ul>
            {@render treeNode(detailDocument)}
        </ul>
    </div>
</div>
