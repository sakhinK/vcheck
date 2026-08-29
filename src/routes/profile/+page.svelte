<script>
  export let data;
</script>

<svelte:head><title>My data</title></svelte:head>

<div class="container section" style="max-width:760px">
  <h1>My data</h1>

  {#if !data.student}
    <div class="alert alert-info">No student record is linked to your account yet. Ask your faculty officer to register you with your institutional email.</div>
  {:else}
    <div class="card">
      <div class="card-title">{data.student.first_name} {data.student.last_name}</div>
      <p class="muted">{data.student.student_code} · {data.student.faculty} · {data.student.program}</p>
      <form method="POST" action="/students/{data.student.id}?/createVersion">
        <button class="btn btn-primary" type="submit">New data version</button>
      </form>
    </div>

    <div class="card mt-16">
      <div class="card-title">My data versions</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Version</th><th>Status</th><th>Passport</th></tr></thead>
          <tbody>
            {#each data.versions as v (v.id)}
              <tr>
                <td><a href="/versions/{v.id}" class="mono">v{v.version_no}</a></td>
                <td><span class="chip {v.status === 'draft' ? 'chip-warning' : 'chip-neutral'}">{v.status}</span></td>
                <td class="mono">{v.passport_number || '—'}</td>
              </tr>
            {:else}
              <tr><td colspan="3" class="muted text-center">No versions yet.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
