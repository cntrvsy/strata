<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Editor } from "@tiptap/core";
  import Document from "@tiptap/extension-document";
  import Paragraph from "@tiptap/extension-paragraph";
  import Text from "@tiptap/extension-text";
  import CodeBlockShiki from "tiptap-extension-code-block-shiki";

  let { value = $bindable(""), onUpdate } = $props();

  let element: HTMLDivElement;
  let editor: Editor | undefined = $state();

  onMount(async () => {
    editor = new Editor({
      element: element,
      extensions: [
        Document,
        Paragraph,
        Text,
        CodeBlockShiki.configure({
          defaultTheme: "tokyo-night",
          defaultLanguage: "typescript",
        }),
      ],
      content: value,
      editorProps: {
        attributes: {
          class: "prose prose-sm focus:outline-none max-w-none h-full p-4",
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        value = html;
        if (onUpdate) onUpdate(html);
      },
    });
  });

  $effect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });
</script>

<div
  class="tiptap-editor-wrapper bg-base-100 rounded-2xl overflow-hidden border border-base-300 shadow-inner"
>
  <div bind:this={element}></div>
</div>

<style>
  :global(.tiptap pre) {
    background: #0d1117;
    border-radius: 0.75rem;
    padding: 1rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 0.875rem;
    line-height: 1.7;
    border: 1px solid oklch(var(--bc) / 0.1);
  }

  :global(.tiptap code) {
    color: inherit;
    padding: 0;
    background: none;
    font-size: 0.8rem;
  }

  :global(.tiptap p) {
    margin: 0.5rem 0;
  }

  /* Shiki token colors (ensure these match the theme or highligher) */
  :global(.shiki span) {
    color: var(--shiki-light);
  }

  :global(.dark .shiki span) {
    color: var(--shiki-dark);
  }

  .tiptap-editor-wrapper {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
