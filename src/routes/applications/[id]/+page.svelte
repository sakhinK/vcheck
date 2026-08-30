<script>
  import StatusChip from '$components/StatusChip.svelte';
  import { STATUS_LABELS, NAME_SOURCE_LABELS } from '$lib/labels.js';
  export let data;
  export let form;

  const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
  const isOfficer = ['faculty_officer', 'advisor', 'iad_officer', 'iad_director'].includes(data.user.role);
  const canGenerateMemo = ['faculty_officer', 'iad_officer', 'iad_director'].includes(data.user.role);
  const canGenerateLetter = ['iad_officer', 'iad_director'].includes(data.user.role);

  const signedMemo = data.docs.find((d) => d.doc_type === 'signed_memo');
  const signedLetter = data.docs.find((d) => d.doc_type === 'signed_letter');

  const REQ_HINT = {
    signed_memo: { label: 'signed memo', href: `/applications/${data.app.id}/memo`, docType: 'signed_memo', have: signedMemo },
    signed_letter: { label: 'signed letter', href: `/applications/${data.app.id}/letter`, docType: 'signed_letter', have: signedLetter }
  };
</script>

<svelte:head><title>{data.app.application_no}</title></svelte:head>

<div class="container section">
  <div class="flex-between">
    <div>
      <span class="overline">Application</span>
      <h1 class="mono">{data.app.application_no}</h1>
      <p class="muted">
        {data.app.first_name} {data.app.last_name} · {data.app.student_code} · {data.app.faculty}
        · round {data.app.current_round}
      </p>
    </div>
    <StatusChip status={data.app.status} />
  </div>

  {#if form?.error}<div class="alert alert-error">{form.error}</div>{/if}
  {#if form?.ok}<div class="alert alert-success">Updated.</div>{/if}

  <!-- Name-source warning for reviewers (rule 5) -->
  {#if isOfficer && data.app.name_source && data.app.name_source !== 'mrz'}
    <div class="alert alert-warning mt-16">
      <strong>Name is not from the MRZ</strong> ({NAME_SOURCE_LABELS[data.app.name_source]}).
      Machine-read original:
      <span class="mono">{data.app.mrz_raw_name_primary} {data.app.mrz_raw_name_secondary}</span>
    </div>
  {/if}

  {#if data.isApplicant && data.app.name_source === 'applicant_edited'}
    <div class="alert alert-warning mt-16">
      <strong>You submitted with data you edited yourself.</strong>
      The name does not match the passport MRZ. Faculty and IAD have been notified.
      Machine-read original:
      <span class="mono">{data.app.mrz_raw_name_primary} {data.app.mrz_raw_name_secondary}</span>
    </div>
  {/if}

  <!-- Stay / document status for reviewers (remaining stay, expiry, insurance) -->
  {#if isOfficer}
    <div class="card mt-24">
      <div class="card-title">Stay &amp; document status</div>
      <div class="form-row-3">
        <div class="field" style="margin-bottom:0">
          <span class="field-label">Remaining stay in Thailand</span>
          <div>
            {#if data.summary.daysRemaining === null}
              —
            {:else if data.summary.daysRemaining >= 0}
              <strong>{data.summary.daysRemaining} days</strong>
            {:else}
              <strong style="color:var(--error)">Expired {Math.abs(data.summary.daysRemaining)} days ago</strong>
            {/if}
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <span class="field-label">Passport expiry</span>
          <div>
            {data.summary.passportExpiry}
            {#if data.summary.passportExpired}<span class="chip chip-error">expired</span>{/if}
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <span class="field-label">Insurance end</span>
          <div>
            {data.summary.insuranceEnd}
            {#if data.summary.insuranceExpired}<span class="chip chip-error">expired</span>{/if}
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Action panel: current status actions first (per design) -->
  <div class="card mt-24">
    <div class="card-title">Action</div>
    {#if data.actions.length === 0}
      <p class="muted">No actions available at this status.</p>
    {:else}
      {#each data.actions as action (action.to)}
        {#if action.to !== 'terminated'}
          <div class="flex-between" style="align-items:flex-start;gap:16px;padding:8px 0">
            <div style="flex:1">
              <strong>{STATUS_LABELS[action.to]}</strong>
              {#if action.onBehalf}
                <span class="caption"> · IAD may act on behalf of faculty</span>
              {/if}
              {#if action.requires && REQ_HINT[action.requires]}
                {@const req = REQ_HINT[action.requires]}
                <div class="caption mt-8">
                  Requires {req.label}: <a href={req.href}>download PDF</a>
                  {#if req.have}<span class="chip chip-success">uploaded</span>{:else}<span class="chip chip-warning">not uploaded</span>{/if}
                </div>
                <form method="POST" action="?/uploadSigned" enctype="multipart/form-data" class="mt-8 flex gap-8">
                  <input type="hidden" name="docType" value={req.docType} />
                  <input class="input" style="padding:6px" type="file" name="file" accept="application/pdf,image/*" required />
                  <button class="btn btn-secondary btn-sm" type="submit">Upload signed file</button>
                </form>
              {/if}
            </div>
            <form method="POST" action="?/transition" class="flex gap-8" style="align-items:flex-end">
              <input type="hidden" name="to" value={action.to} />
              {#if action.to === 'advisor_pending'}
                <select class="input" name="advisorId" style="max-width:200px" required>
                  <option value="">Choose advisor…</option>
                  {#each data.advisors as adv (adv.id)}
                    <option value={adv.id}>{adv.name}</option>
                  {/each}
                </select>
              {/if}
              {#if action.to === 'rejected'}
                <input class="input" name="comment" placeholder="Reason for return (required)" required style="min-width:220px" />
              {:else}
                <input class="input" name="comment" placeholder="Note (optional)" style="min-width:200px" />
              {/if}
              <button class="btn btn-primary" type="submit" disabled={action.requires && !REQ_HINT[action.requires]?.have}>
                {STATUS_LABELS[action.to]}
              </button>
            </form>
          </div>
        {/if}
      {/each}

      {#if data.isApplicant && data.app.status === 'rejected'}
        <form method="POST" action="?/resubmit" class="mt-16">
          <button class="btn btn-primary" type="submit">Resubmit (same number, new round)</button>
        </form>
      {/if}
    {/if}
  </div>

  <!-- Identity & details -->
  <div class="card mt-24">
    <div class="card-title">Application details</div>
    <div class="form-row-3">
      <div class="field"><label>Passport name</label><div>{data.app.name_primary} {data.app.name_secondary}</div></div>
      <div class="field"><label>Passport number</label><div class="mono">{data.app.passport_number || '—'}</div></div>
      <div class="field"><label>Nationality</label><div>{data.app.nationality || '—'}</div></div>
    </div>
    <div class="form-row-3">
      <div class="field"><label>Date of birth</label><div>{data.app.date_of_birth || '—'}</div></div>
      <div class="field"><label>Passport expiry</label><div>{data.app.passport_expiry_date || '—'}</div></div>
      <div class="field"><label>Last allowed stay</label><div>{data.app.visa_last_allowed_date || '—'}</div></div>
    </div>
    <div class="form-row-3">
      <div class="field"><label>Insurance</label><div>{data.app.insurance_company || '—'}</div></div>
      <div class="field"><label>Coverage end</label><div>{data.app.insurance_end_date || '—'}</div></div>
      <div class="field"><label>Phone</label><div>{data.app.phone || '—'}</div></div>
    </div>
    <div class="divider"></div>
    <div class="flex-between">
      <span class="caption">Data version v{data.app.version_no} · name source: {NAME_SOURCE_LABELS[data.app.name_source] || data.app.name_source}</span>
      <div class="flex gap-8">
        {#if canGenerateMemo}<a class="btn btn-secondary btn-sm" href="/applications/{data.app.id}/memo">Download memo</a>{/if}
        {#if canGenerateLetter}<a class="btn btn-secondary btn-sm" href="/applications/{data.app.id}/letter">Download letter</a>{/if}
      </div>
    </div>
  </div>

  <!-- Attachments -->
  <div class="card mt-24">
    <div class="card-title">Attachments</div>
    <ul class="checklist">
      {#each data.versionDocs as d (d.id)}
        <li class="ok"><span class="dot">✓</span><span style="flex:1"><strong>{d.doc_key}</strong><span class="caption"> · {d.file_name}</span></span></li>
      {/each}
    </ul>
  </div>

  <!-- Progress timeline (applicant) / audit trail (officers) -->
  <div class="card mt-24">
    <div class="card-title">{data.isApplicant ? 'Progress' : 'History & audit trail'}</div>

    {#if data.isApplicant}
      <ul class="timeline">
        {#each data.milestones as m, i (m.status)}
          <li class:done={i < data.currentMilestone} class:current={i === data.currentMilestone}>{m.label}</li>
        {/each}
      </ul>
    {/if}

    <div class="table-wrap mt-16">
      <table>
        <thead><tr><th>From</th><th>To</th><th>By</th><th>Note</th><th>On behalf of</th><th>When</th></tr></thead>
        <tbody>
          {#each data.audit as a (a.id)}
            <tr>
              <td class="muted">{a.from_status || '—'}</td>
              <td>{a.to_status}</td>
              <td>{a.actor_name || a.actor_role || '—'}</td>
              <td>{a.comment || '—'}</td>
              <td>{#if a.acted_on_behalf_of}<span class="chip chip-indigo">{a.acted_on_behalf_of}</span>{:else}—{/if}</td>
              <td class="muted">{fmt(a.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  {#if data.nameEdits.length}
    <div class="card mt-24">
      <div class="card-title">Name corrections (visible to applicant)</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Old</th><th>New</th><th>By</th><th>Reason</th><th>When</th></tr></thead>
          <tbody>
            {#each data.nameEdits as e (e.id)}
              <tr>
                <td>{e.old_primary} {e.old_secondary}</td>
                <td>{e.new_primary} {e.new_secondary}</td>
                <td>{e.editor_name || e.role}</td>
                <td>{e.reason}</td>
                <td class="muted">{fmt(e.created_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if data.actions.some((a) => a.to === 'terminated')}
    <div class="card mt-24" style="border-color:var(--error)">
      <div class="card-title" style="color:var(--error)">Danger zone</div>
      <p class="caption">Terminating is final and locks the data version. A reason is required.</p>
      <form method="POST" action="?/transition">
        <input type="hidden" name="to" value="terminated" />
        <div class="field"><input class="input" name="comment" placeholder="Reason for cancellation (required)" required /></div>
        <button class="btn btn-danger" type="submit">Terminate application</button>
      </form>
    </div>
  {/if}
</div>
