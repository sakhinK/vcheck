<script>
  import StudentVersions from '$components/StudentVersions.svelte';
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
    <StudentVersions versions={data.versions} canDelete={data.canEdit} deleteAction="?/deleteVersion" />
  </div>
</div>
