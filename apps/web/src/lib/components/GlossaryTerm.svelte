<script lang="ts">
let { term, definition, href }: { term: string; definition: string; href: string } = $props()
const id = $props.id()
</script>

<span class="glossary-term">
  <a {href} aria-describedby={id} class="underline decoration-dotted underline-offset-4">{term}</a>
  <span {id} class="definition text-sm font-normal text-ink">{definition}</span>
</span>

<style>
  .definition {
    display: none;
  }

  .glossary-term:hover .definition,
  .glossary-term:focus-within .definition {
    display: block;
    max-width: 38ch;
    padding-block: 0.25rem;
  }
</style>
