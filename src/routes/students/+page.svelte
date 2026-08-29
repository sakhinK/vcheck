<script>
  export let data;
</script>

<svelte:head><title>Students — IAD Visa Desk</title></svelte:head>

<div class="container section">
  <div class="flex-between">
    <h1>International students</h1>
    {#if data.canRegister}
      <a class="btn btn-primary" href="/students/new">Register student</a>
    {/if}
  </div>

  <form method="GET" action="/students" class="mt-16" style="max-width:480px">
    <input class="input" name="q" placeholder="Search name, code or email…" value={data.query} />
  </form>

  <div class="table-wrap mt-16">
    <table>
      <thead>
        <tr><th>Code</th><th>Name</th><th>Country</th><th>Faculty</th><th>Program</th><th>Linked</th></tr>
      </thead>
      <tbody>
        {#each data.students as s (s.id)}
          <tr>
            <td class="mono">{s.student_code || '—'}</td>
            <td><a href="/students/{s.id}">{s.first_name} {s.last_name}</a></td>
            <td>{s.country || '—'}</td>
            <td>{s.faculty || '—'}</td>
            <td>{s.program || '—'}</td>
            <td>{#if s.linked_user_email}<span class="chip chip-success">linked</span>{:else}<span class="chip chip-neutral">unlinked</span>{/if}</td>
          </tr>
        {:else}
          <tr><td colspan="6" class="muted text-center">No students found.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
