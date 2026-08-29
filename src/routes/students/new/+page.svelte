<script>
  export let form;
</script>

<svelte:head><title>Register student</title></svelte:head>

<div class="container section" style="max-width:720px">
  <h1>Register international student</h1>
  {#if form?.error}<div class="alert alert-error">{form.error}</div>{/if}

  <form method="POST" class="card">
    <div class="form-row">
      <div class="field"><label>First name</label><input class="input" name="firstName" required /></div>
      <div class="field"><label>Last name</label><input class="input" name="lastName" required /></div>
    </div>
    <div class="form-row">
      <div class="field"><label>Student code</label><input class="input" name="studentCode" /></div>
      <div class="field"><label>Country</label><input class="input" name="country" /></div>
    </div>
    <div class="field"><label>Email (matches SSO on first login)</label><input class="input" name="email" type="email" required /></div>
    <div class="form-row">
      <div class="field"><label>Faculty</label><input class="input" name="faculty" value="Faculty of Engineering" /></div>
      <div class="field"><label>Degree level</label>
        <select class="input" name="degreeLevel">
          <option>Bachelor</option><option>Master</option><option>Doctoral</option>
        </select>
      </div>
    </div>
    <div class="field"><label>Program</label><input class="input" name="program" /></div>
    <div class="flex gap-8">
      <button class="btn btn-primary" type="submit">Register</button>
      <a class="btn btn-ghost" href="/students">Cancel</a>
    </div>
  </form>
</div>
