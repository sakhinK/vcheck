<script>
  import StatusChip from '$components/StatusChip.svelte';

  export let versions = [];
  export let canDelete = false;
  export let deleteAction = '';
</script>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Version</th>
        <th>Status</th>
        <th>Passport</th>
        <th>Nationality</th>
        <th>Application</th>
        <th>Updated</th>
        {#if canDelete}<th></th>{/if}
      </tr>
    </thead>
    <tbody>
      {#each versions as v (v.id)}
        <tr>
          <td><a href="/versions/{v.id}" class="mono">v{v.version_no}</a></td>
          <td><span class="chip {v.status === 'draft' ? 'chip-warning' : 'chip-neutral'}">{v.status}</span></td>
          <td class="mono">{v.passport_number || '—'}</td>
          <td>{v.nationality || '—'}</td>
          <td>
            {#if v.application_id}
              <a href="/applications/{v.application_id}" class="mono">{v.application_no}</a>
              <div class="caption mt-8"><StatusChip status={v.application_status} /></div>
            {:else}
              <span class="caption">Unused</span>
            {/if}
          </td>
          <td class="muted">{v.updated_at ? new Date(v.updated_at).toISOString().slice(0, 10) : '—'}</td>
          {#if canDelete}
            <td>
              {#if v.status === 'draft' && !v.application_id}
                <form
                  method="POST"
                  action={deleteAction}
                  style="margin:0"
                  on:submit={(e) => { if (!confirm('Delete this data version and its documents?')) e.preventDefault(); }}
                >
                  <input type="hidden" name="versionId" value={v.id} />
                  <button class="btn btn-ghost btn-sm" type="submit" style="color:var(--error)">Delete</button>
                </form>
              {/if}
            </td>
          {/if}
        </tr>
      {:else}
        <tr><td colspan={canDelete ? 7 : 6} class="muted text-center">No data versions yet.</td></tr>
      {/each}
    </tbody>
  </table>
</div>
