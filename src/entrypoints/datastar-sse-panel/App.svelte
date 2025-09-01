<script lang="ts">
    import { Pane, Splitpanes } from "svelte-splitpanes";
    import { SvelteMap } from "svelte/reactivity";
    import * as Table from "$lib/components/ui/table/index.ts";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Separator } from "$lib/components/ui/separator/index.js";
    import PanelBottomClose from "@lucide/svelte/icons/panel-bottom-close";
    import Crosshair from "@lucide/svelte/icons/crosshair";

    import { createStore } from "../../lib/store";
    import { derived } from "svelte/store";

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

    let storeA = createStore("[]", "session:sseEvents");
    let sseEvents = derived(storeA, ($s) => JSON.parse($s));
    let showing = $state(false);

    let selectors = [];

    function highlightSelectors() {
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
                    (result, exceptionInfo) => {
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
            (result, exceptionInfo) => {
                if (exceptionInfo && exceptionInfo.isException) {
                    console.error("Eval failed:", exceptionInfo);
                } else {
                    console.log("Result:", result);
                }
            },
        );
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

    let getSelector = (event: object): string => {
        if (event.argsRaw && event.argsRaw.selector) {
            selectors = [event.argsRaw.selector];
            return;
        }

        selectors = [];

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
</script>

<div class="h-screen">
    <Splitpanes horizontal={true}>
        <Pane>
            <div
                class="overflow-y-auto min-w-0 h-full bg-zinc-800 text-gray-300 w-full"
            >
                <Table.Root class="table-auto">
                    <colgroup>
                        <col class="max-w-px w-full" />
                        <col class="max-w-px w-full" />
                        <col class="max-w-px w-full" />
                        <col />
                    </colgroup>
                    <Table.Header
                        class="bg-zinc-800 text-gray-300 border-b border-gray-200"
                    >
                        <Table.Row>
                            <Table.Head
                                class="sticky top-0 bg-zinc-800 text-gray-300 border-b border-gray-200"
                                >Type</Table.Head
                            >
                            <Table.Head
                                class="sticky top-0 bg-zinc-800 text-gray-300 border-b border-gray-200"
                                >Selector</Table.Head
                            >
                            <Table.Head
                                class="sticky top-0 bg-zinc-800 text-gray-300 border-b border-gray-200"
                                >Mode</Table.Head
                            >
                            <Table.Head
                                class="sticky top-0 bg-zinc-800 text-gray-300 border-b border-gray-200"
                                >Elements/Signals</Table.Head
                            >
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {#each $storeA as event}
                            {#if event.type != "started" && event.type != "finished"}
                                <Table.Row
                                    onclick={() => {
                                        removeHighlights();
                                        if (!showing) {
                                            showing = true;
                                        }
                                        if (event.argsRaw.elements) {
                                            detailContent =
                                                event.argsRaw.elements;
                                            getSelector(event);
                                        } else {
                                            selector = "";
                                            detailContent = "";
                                        }
                                    }}
                                >
                                    <Table.Cell>
                                        {#if event.type == "datastar-patch-elements"}
                                            patch
                                        {:else if event.type == "datastar-patch-signals"}
                                            signals
                                        {:else}
                                            {event.type}
                                        {/if}
                                    </Table.Cell>
                                    {#if event.argsRaw}
                                        {#if event.type == "datastar-patch-elements"}
                                            <Table.Cell>
                                                {event.argsRaw.selector}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {event.argsRaw.mode}
                                            </Table.Cell>
                                            <Table.Cell class="min-w-0">
                                                <span
                                                    class="block overflow-hidden text-ellipsis"
                                                >
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
                                            </Table.Cell>
                                        {:else}
                                            <Table.Cell>&nbsp;</Table.Cell>
                                            <Table.Cell>&nbsp;</Table.Cell>
                                            <Table.Cell class="truncate"
                                                >&nbsp;</Table.Cell
                                            >
                                        {/if}
                                    {/if}
                                </Table.Row>
                            {/if}
                        {/each}
                    </Table.Body>
                </Table.Root>
            </div>
        </Pane>
        {#if showing}
            <Pane minSize={20}>
                <div
                    class="h-full overflow-y-auto px-2 bg-zinc-800 text-gray-300"
                >
                    <div class="flex justify-between">
                        <Button
                            variant="ghost"
                            onclick={() => highlightSelectors()}
                        >
                            <Crosshair />
                            Show selector target</Button
                        >
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={() => (showing = false)}
                        >
                            <PanelBottomClose />
                        </Button>
                    </div>
                    <Separator class="my-1" />
                    <div class="details font-mono">
                        {#snippet treeNode(node)}
                            <ul>
                                {#each node.childNodes as child}
                                    {#if child.nodeType === Node.TEXT_NODE}
                                        {child.textContent}
                                    {/if}
                                {/each}
                                {#each node.children as child}
                                    <li>
                                        <span
                                            class={nodeCollapsed.get(child)
                                                ? "cursor-pointer"
                                                : "cursor-pointer inline-block rotate-90"}
                                            onclick={() => toggleChild(child)}
                                            >&#x25b6;
                                        </span>
                                        &lt;{child.nodeName.toLowerCase()}{attributeString(
                                            child,
                                        )}&gt;
                                        {#if !nodeCollapsed.get(child)}
                                            {@render treeNode(child)}
                                            <span class="ml-2">
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
