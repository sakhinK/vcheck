<script>
  import '../lib/design/global.css';
  import Nav from '$components/Nav.svelte';
  export let data;
</script>

<Nav user={data.user} devMode={data.devMode} />
<main>
  <slot />
</main>
