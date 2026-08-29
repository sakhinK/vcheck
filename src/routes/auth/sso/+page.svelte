<script>
  export let form;
</script>

<svelte:head><title>KKU SSO — Mock</title></svelte:head>

<div class="container" style="max-width:440px;padding-top:64px">
  <div class="card">
    <div class="text-center" style="margin-bottom:24px">
      <img src="/kkulogo/1. official logo 2022-03.png" alt="KKU" style="height:56px" />
      <h2 style="margin-top:12px">KKU Single Sign-On</h2>
      <p class="muted">Mock consent screen (offline).</p>
    </div>

    {#if form?.error}
      <div class="alert alert-error">{form.error}</div>
    {/if}

    <form method="POST">
      <div class="field">
        <label for="email">Institutional email</label>
        <input class="input" id="email" name="email" type="email" value="student@kkufa.dev" required />
      </div>
      <div class="field">
        <label for="name">Display name</label>
        <input class="input" id="name" name="name" type="text" value="Anna Maria Eriksson" />
      </div>
      <button class="btn btn-primary btn-lg" style="width:100%" type="submit">Authorize &amp; continue</button>
      <p class="caption text-center mt-16">This simulates KKU-SSO. No real credentials are used.</p>
    </form>
  </div>
</div>
