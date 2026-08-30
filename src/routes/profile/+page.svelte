<script>
  import StudentVersions from '$components/StudentVersions.svelte';
  export let data;
  export let form;
</script>

<svelte:head><title>My data</title></svelte:head>

<div class="container section" style="max-width:760px">
  <h1>My data</h1>

  {#if form?.error}<div class="alert alert-error">{form.error}</div>{/if}

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
      <StudentVersions versions={data.versions} canDelete deleteAction="?/deleteVersion" />
    </div>
  {/if}
</div>
