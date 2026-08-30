<script>
  import StatusChip from '$components/StatusChip.svelte';
  export let data;
  const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
  const stayLabel = (s) => {
    if (!s || s.daysRemaining === null) return '—';
    if (s.daysRemaining >= 0) return `${s.daysRemaining} days`;
    return `Expired ${Math.abs(s.daysRemaining)} days ago`;
  };
</script>

<svelte:head><title>Dashboard — IAD Visa Desk</title></svelte:head>

<div class="container section">
  <h1>Dashboard</h1>
  <p class="muted">Signed in as {data.user.name}.</p>

  {#if data.user.role === 'international_student'}
    {#if data.hasData}
      <div class="card mt-16">
        <div class="card-title">My stay status</div>
        <div class="grid grid-stats">
          <div class="stat">
            <span class="stat-value" style:color={data.statusSummary.stayExpired ? 'var(--error)' : undefined}>{stayLabel(data.statusSummary)}</span>
            <span class="stat-label">Remaining stay in Thailand</span>
          </div>
          <div class="stat">
            <span class="stat-value">{data.statusSummary.passportExpiry}</span>
            <span class="stat-label">Passport expiry {#if data.statusSummary.passportExpired}<span class="chip chip-error">expired</span>{/if}</span>
          </div>
          <div class="stat">
            <span class="stat-value">{data.statusSummary.insuranceEnd}</span>
            <span class="stat-label">Insurance end {#if data.statusSummary.insuranceExpired}<span class="chip chip-error">expired</span>{/if}</span>
          </div>
        </div>
      </div>
    {:else}
      <div class="card mt-16">
        <div class="card-title">Getting started</div>
        {#if !data.student}
          <div class="alert alert-info">Your account is not linked to a student record yet. Ask your faculty officer to register you with your institutional email.</div>
        {/if}
        <ol class="steps">
          <li>Confirm your student record is linked to your account.</li>
          <li>Open <a href="/profile">My data</a> and create a data version.</li>
          <li>Scan your passport data page to read the MRZ.</li>
          <li>Confirm your passport name, then fill in visa and insurance details.</li>
          <li>Upload the five required documents.</li>
          <li>Submit your visa extension application.</li>
        </ol>
        <a class="btn btn-primary mt-16" href="/profile">Go to My data</a>
      </div>
    {/if}
  {/if}

  {#if data.isReviewer}
    <div class="card mt-16">
      <div class="flex-between">
        <div class="card-title" style="margin:0">Notifications</div>
        {#if data.notifications.length}
          <form method="POST" action="?/markNotificationsRead" style="margin:0">
            <button class="btn btn-ghost btn-sm" type="submit">Mark all read</button>
          </form>
        {/if}
      </div>
      {#if data.notifications.length}
        <ul class="checklist mt-16">
          {#each data.notifications as n (n.id)}
            <li class:ok={!n.read_at}>
              <span class="dot">{n.read_at ? '' : '●'}</span>
              <span style="flex:1">
                <strong>{n.title}</strong>
                <div class="caption">{n.message}</div>
                {#if n.link}<a href={n.link}>View application</a>{/if}
              </span>
              <span class="caption">{fmt(n.created_at)}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">No notifications.</p>
      {/if}
    </div>
  {/if}

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
