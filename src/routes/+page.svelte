<script>
  export let data;
</script>

<svelte:head>
  <title>IAD Visa Desk — KKU</title>
</svelte:head>

{#if data.user}
  <div class="hero">
    <span class="chip chip-success">Signed in</span>
    <h1>Welcome back, {data.user.name}</h1>
    <p class="muted">You are signed in as {data.user.role}.</p>
    <a class="btn btn-primary btn-lg" href="/dashboard">Go to dashboard</a>
  </div>
{:else}
  <div class="hero">
    <img src="/kkulogo/1. official logo 2022-26.png" alt="KKU" style="height:72px" />
    <h1>Visa extension requests, from submission to the Immigration Bureau</h1>
    <p class="muted">
      For international students of Khon Kaen University. Track your request,
      upload passport documents, and follow every step of approval.
    </p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
      <a class="btn btn-primary btn-lg" href="/auth/sso">Continue with KKU SSO</a>
      {#if data.devMode}
        <a class="btn btn-secondary btn-lg" href="/auth/dev-login">Dev login (roles)</a>
      {/if}
    </div>
    <p class="caption">KKU-SSO sign-in is mocked for offline development.</p>
  </div>
{/if}
