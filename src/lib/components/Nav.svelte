<script>
  import { ROLE_LABELS } from '$lib/labels.js';

  export let user = null;
  export let devMode = false;

  const links = () => {
    if (!user) return [];
    const l = [{ href: '/dashboard', label: 'Dashboard' }, { href: '/applications', label: 'Applications' }];
    if (user.role === 'international_student') {
      l.push({ href: '/profile', label: 'My data' });
    } else if (user.role === 'faculty_officer' || user.role === 'iad_officer' || user.role === 'iad_director') {
      l.push({ href: '/students', label: 'Students' });
    }
    return l;
  };
</script>

<header class="nav">
  <a class="nav-logo" href="/">
    <img src="/kkulogo/1. official logo 2022-03.png" alt="KKU" />
    <span>IAD Visa Desk</span>
  </a>

  <nav class="nav-links">
    {#each links() as link (link.href)}
      <a href={link.href}>{link.label}</a>
    {/each}
  </nav>

  <div class="nav-user">
    {#if user}
      <span>
        <strong>{user.name}</strong>
        <span class="muted"> · {ROLE_LABELS[user.role] || user.role}</span>
      </span>
      {#if devMode}
        <a class="btn btn-ghost btn-sm" href="/auth/dev-login">Switch user</a>
      {/if}
      <form method="POST" action="/auth/logout" style="margin:0">
        <button class="btn btn-ghost btn-sm" type="submit">Log out</button>
      </form>
    {:else}
      <a class="btn btn-primary btn-sm" href="/">Sign in</a>
    {/if}
  </div>
</header>
