<script>
  import { ROLE_LABELS } from '$lib/labels.js';
  export let data;
  export let form;
</script>

<svelte:head><title>Dev login</title></svelte:head>

<div class="container" style="max-width:640px;padding-top:64px">
  <div class="card">
    <h2>Dev login — switch role</h2>
    <p class="muted">Sign in as any seeded sample user to exercise the workflow.</p>
    {#if form?.error}<div class="alert alert-error">{form.error}</div>{/if}
    <ul class="checklist">
      {#each data.devUsers as u (u.id)}
        <li>
          <div style="flex:1">
            <strong>{u.name}</strong>
            <span class="muted"> · {u.email}</span>
            <div class="caption">{ROLE_LABELS[u.role]}</div>
          </div>
          <form method="POST" style="margin:0">
            <input type="hidden" name="userId" value={u.id} />
            <button class="btn btn-secondary btn-sm" type="submit">Sign in</button>
          </form>
        </li>
      {/each}
    </ul>
  </div>
</div>
