<script>
  import StatusChip from '$components/StatusChip.svelte';
  export let data;
  const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
</script>

<svelte:head><title>Dashboard — IAD Visa Desk</title></svelte:head>

<div class="container section">
  <h1>Dashboard</h1>
  <p class="muted">Signed in as {data.user.name}.</p>

  <div class="grid grid-stats mt-16">
    {#each data.stats as s (s.label)}
      <div class="card stat">
        <span class="stat-value">{s.value}</span>
        <span class="stat-label">{s.label}</span>
      </div>
    {/each}
  </div>

  <div class="flex-between mt-24">
    <h2>Applications</h2>
    <a class="btn btn-secondary" href="/applications">View all</a>
  </div>

  <div class="table-wrap mt-16">
    <table>
      <thead>
        <tr><th>Number</th><th>Student</th><th>Status</th><th>Round</th><th>Submitted</th></tr>
      </thead>
      <tbody>
        {#each data.applications as a (a.id)}
          <tr>
            <td><a href="/applications/{a.id}" class="mono">{a.application_no}</a></td>
            <td>{a.first_name} {a.last_name}</td>
            <td><StatusChip status={a.status} /></td>
            <td>{a.current_round}</td>
            <td class="muted">{fmt(a.submitted_at || a.created_at)}</td>
          </tr>
        {:else}
          <tr><td colspan="5" class="muted text-center">No applications yet.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
