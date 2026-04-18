<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";
  import Document from "@tiptap/extension-document";
  import Paragraph from "@tiptap/extension-paragraph";
  import Text from "@tiptap/extension-text";
  import CodeBlockShiki from "tiptap-extension-code-block-shiki";
  import History from "@tiptap/extension-history";

  let { value = $bindable(""), onUpdate } = $props();
  let element: HTMLDivElement;
  let editor: Editor | undefined = $state();
  let isInternalChange = false;

  onMount(async () => {
    editor = new Editor({
      element: element,
      extensions: [
        Document,
        Paragraph,
        Text,
        History,
        CodeBlockShiki.configure({
          defaultTheme: "tokyo-night",
          defaultLanguage: "typescript",
        }),
      ],
      content: value || '<pre><code></code></pre>',
      editorProps: {
        attributes: {
          class: "prose prose-sm focus:outline-none max-w-none h-full p-4 font-mono leading-relaxed",
        },
      },
      onUpdate: ({ editor }) => {
        isInternalChange = true;
        const html = editor.getHTML();
        value = html;
        if (onUpdate) onUpdate(html);
        // Sync flag after microtask
        setTimeout(() => { isInternalChange = false; }, 0);
      },
    });
  });

  $effect(() => {
    if (editor && value !== editor.getHTML() && !isInternalChange) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  });

  onDestroy(() => {
    editor?.destroy();
  });
</script>

<div
  class="tiptap-editor-wrapper bg-base-100 rounded-2xl overflow-hidden border border-base-300 shadow-inner h-full"
>
  <div bind:this={element} class="h-full overflow-auto"></div>
</div>

<style>
  :global(.tiptap pre) {
    background: transparent !important;
    border-radius: 0;
    padding: 0;
    margin: 0;
    font-family: inherit;
    border: none;
  }

  :global(.tiptap) {
    height: 100%;
  }

  /* Remove default prose margins for code focus */
  :global(.tiptap p) {
    margin: 0;
  }

  .tiptap-editor-wrapper {
    display: flex;
    flex-direction: column;
  }
</style>
