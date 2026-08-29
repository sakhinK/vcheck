<script>
  import StatusChip from '$components/StatusChip.svelte';
  import { STATUS_LABELS } from '$lib/labels.js';
  export let data;
  const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
</script>

<svelte:head><title>Applications — IAD Visa Desk</title></svelte:head>

<div class="container section">
  <div class="flex-between">
    <h1>Applications</h1>
    {#if data.user.role === 'international_student' && data.student}
      <a class="btn btn-primary" href="/applications/new">New application</a>
    {/if}
  </div>

  <form method="GET" action="/applications" class="mt-16 flex gap-8" style="max-width:640px">
    <input class="input" name="q" placeholder="Search number or name…" value={data.query} />
    <select class="input" name="status" style="max-width:240px">
      <option value="">All statuses</option>
      {#each Object.entries(STATUS_LABELS) as [value, label] (value)}
        <option value={value} selected={data.status === value}>{label}</option>
      {/each}
    </select>
    <button class="btn btn-secondary" type="submit">Filter</button>
  </form>

  <div class="table-wrap mt-16">
    <table>
      <thead>
        <tr><th>Number</th><th>Student</th><th>Faculty</th><th>Status</th><th>Round</th><th>Submitted</th></tr>
      </thead>
      <tbody>
        {#each data.applications as a (a.id)}
          <tr>
            <td><a href="/applications/{a.id}" class="mono">{a.application_no}</a></td>
            <td>{a.first_name} {a.last_name}</td>
            <td>{a.faculty || '—'}</td>
            <td><StatusChip status={a.status} /></td>
            <td>{a.current_round}</td>
            <td class="muted">{fmt(a.submitted_at || a.created_at)}</td>
          </tr>
        {:else}
          <tr><td colspan="6" class="muted text-center">No applications found.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
