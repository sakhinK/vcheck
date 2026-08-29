<script>
  export let data;
</script>

<svelte:head><title>{data.student.first_name} {data.student.last_name}</title></svelte:head>

<div class="container section">
  <div class="flex-between">
    <div>
      <span class="overline">Student</span>
      <h1>{data.student.first_name} {data.student.last_name}</h1>
      <p class="muted">
        {data.student.student_code || 'No code'} · {data.student.country || '—'} ·
        {data.student.faculty || '—'} · {data.student.program || '—'}
      </p>
    </div>
    {#if data.canEdit}
      <form method="POST" action="?/createVersion" style="margin:0">
        <button class="btn btn-primary" type="submit">New data version</button>
      </form>
    {/if}
  </div>

  <div class="card mt-24">
    <div class="card-title">Data versions</div>
    <p class="caption">Passport / visa / insurance data is versioned — new passport or entry stamp means a new version.</p>
    <div class="table-wrap mt-16">
      <table>
        <thead><tr><th>Version</th><th>Status</th><th>Passport</th><th>Nationality</th><th>Updated</th></tr></thead>
        <tbody>
          {#each data.versions as v (v.id)}
            <tr>
              <td><a href="/versions/{v.id}" class="mono">v{v.version_no}</a></td>
              <td><span class="chip {v.status === 'draft' ? 'chip-warning' : 'chip-neutral'}">{v.status}</span></td>
              <td class="mono">{v.passport_number || '—'}</td>
              <td>{v.nationality || '—'}</td>
              <td class="muted">{v.updated_at ? new Date(v.updated_at).toISOString().slice(0, 10) : '—'}</td>
            </tr>
          {:else}
            <tr><td colspan="5" class="muted text-center">No data versions yet.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
