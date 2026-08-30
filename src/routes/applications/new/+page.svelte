<script>
  export let data;
  export let form;
</script>

<svelte:head><title>New application</title></svelte:head>

<div class="container section" style="max-width:760px">
  <h1>New visa extension application</h1>
  <p class="muted">Choose a draft data version with a confirmed name and all required documents.</p>

  {#if form?.error}<div class="alert alert-error">{form.error}</div>{/if}

  {#each data.versions as v (v.id)}
    <div class="card mt-16">
      <div class="flex-between">
        <div>
          <strong>Data version v{v.version_no}</strong>
          <div class="caption mt-8">
            Passport: <span class="mono">{v.passport_number || '—'}</span> ·
            Name: {v.name_primary || '—'} {v.name_secondary || ''}
          </div>
        </div>
        <div class="flex gap-8" style="align-items:center">
          <span class="chip {v.nameCertified ? 'chip-success' : 'chip-warning'}">{v.nameCertified ? 'name confirmed' : 'name not confirmed'}</span>
          <span class="chip {v.allDocs ? 'chip-success' : 'chip-warning'}">{v.allDocs ? 'docs complete' : 'docs missing'}</span>
        </div>
      </div>
      {#if v.nameEdited}
        <div class="alert alert-warning mt-16">
          <strong>You are submitting with data you edited yourself.</strong>
          The name differs from the passport MRZ. Faculty and IAD will be notified.
        </div>
      {/if}
      {#if v.passportExpired}
        <div class="alert alert-error mt-16">This passport has expired and cannot be used to submit a request.</div>
      {/if}
      {#if v.nameCertified && v.allDocs}
        {#if v.passportExpired}
          <p class="caption mt-16">This version cannot be submitted because the passport has expired. Scan a valid passport into a new data version.</p>
        {:else}
          <form method="POST" class="mt-16">
            <input type="hidden" name="versionId" value={v.id} />
            <button class="btn btn-primary" type="submit">Submit with this version</button>
          </form>
        {/if}
      {:else}
        <a class="btn btn-secondary mt-16" href="/versions/{v.id}">Complete this version</a>
      {/if}
    </div>
  {:else}
    <div class="card mt-16"><p class="muted text-center">No draft versions yet. Create one from your student profile.</p></div>
  {/each}
</div>
