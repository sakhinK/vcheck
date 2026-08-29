<script>
  export let data;
  export let form;

  const nameSourceLabel = {
    mrz: 'Read from MRZ',
    applicant_edited: 'Edited by applicant',
    officer_edited: 'Corrected by officer'
  };
</script>

<svelte:head><title>Data version v{data.version.version_no}</title></svelte:head>

<div class="container section" style="max-width:960px">
  <div class="flex-between">
    <div>
      <span class="overline">Data version</span>
      <h1>v{data.version.version_no} — {data.student.first_name} {data.student.last_name}</h1>
      <p class="muted">
        {data.student.student_code} · status:
        <span class="chip {data.version.status === 'draft' ? 'chip-warning' : 'chip-neutral'}">{data.version.status}</span>
      </p>
    </div>
    <a class="btn btn-ghost" href="/students/{data.student.id}">Back to student</a>
  </div>

  {#if !data.canEditDraft}
    <div class="alert alert-info">This version is locked because an application using it reached a terminal status.</div>
  {/if}

  <!-- Passport scan -->
  <div class="card mt-24">
    <div class="card-title">1 · Passport scan (MRZ)</div>
    <p class="caption">
      The passport number, date of birth, expiry and nationality are read from the
      machine-readable zone <strong>on the server</strong> — they can never be typed in.
    </p>

    {#if form?.scanError}<div class="alert alert-error">{form.scanError}</div>{/if}
    {#if form?.scanOk}
      <div class="alert alert-success">Passport scanned and verified. All MRZ check digits passed.</div>
    {/if}
    {#if form?.warnings?.length}
      <div class="alert alert-warning">
        {#each form.warnings as w}<div>• {w}</div>{/each}
      </div>
    {/if}

    {#if data.canEditDraft}
      <div class="flex gap-16" style="align-items:flex-start;flex-wrap:wrap">
        <form method="POST" action="?/scanPassport" enctype="multipart/form-data">
          <div class="field">
            <label>Upload passport data page (image/PDF)</label>
            <input class="input" type="file" name="file" accept="image/*,application/pdf" required />
          </div>
          <button class="btn btn-primary" type="submit">Scan &amp; verify</button>
        </form>
        {#if data.devMode}
          <form method="POST" action="?/scanSpecimen">
            <div class="field"><label>Offline dev</label></div>
            <button class="btn btn-secondary" type="submit">Scan ICAO specimen (dev)</button>
          </form>
        {/if}
      </div>
    {/if}

    {#if data.version.passport_number}
      <div class="divider"></div>
      <div class="form-row-3">
        <div class="field"><label>Passport number</label><div class="mono"><span class="chip chip-success">verified</span> {data.version.passport_number}</div></div>
        <div class="field"><label>Date of birth</label><div><span class="chip chip-success">verified</span> {data.version.date_of_birth}</div></div>
        <div class="field"><label>Expiry</label><div><span class="chip chip-success">verified</span> {data.version.passport_expiry_date}</div></div>
      </div>
      <div class="form-row-3">
        <div class="field"><label>Nationality</label><div><span class="chip chip-neutral">not protected</span> {data.version.nationality}</div></div>
        <div class="field"><label>Sex</label><div><span class="chip chip-neutral">not protected</span> {data.version.sex}</div></div>
        <div class="field"><label>Issue date (manual)</label><div>{data.version.passport_issue_date || '—'}</div></div>
      </div>
      <p class="caption">Fields marked <em>not protected</em> are not covered by any MRZ check digit, so they are shown without a "verified" mark (rule 3).</p>
    {/if}
  </div>

  <!-- Name -->
  <div class="card mt-24">
    <div class="card-title">2 · Passport name</div>
    {#if data.version.name_source && data.version.name_source !== 'mrz'}
      <div class="alert alert-warning">
        This name is <strong>{nameSourceLabel[data.version.name_source]}</strong>, not the raw MRZ value.
        Original machine-read name:
        <span class="mono">{data.version.mrz_raw_name_primary} {data.version.mrz_raw_name_secondary}</span>
      </div>
    {/if}

    {#if form?.nameError}<div class="alert alert-error">{form.nameError}</div>{/if}
    {#if form?.nameOk}<div class="alert alert-success">Name saved.</div>{/if}

    <form method="POST" action="?/certifyName">
      <div class="form-row">
        <div class="field">
          <label>Primary identifier (surname)</label>
          <input class="input" name="primary" value={data.version.name_primary || ''} disabled={data.version.name_certified === 1 && !data.isOfficer} />
        </div>
        <div class="field">
          <label>Secondary identifier (given names)</label>
          <input class="input" name="secondary" value={data.version.name_secondary || ''} disabled={data.version.name_certified === 1 && !data.isOfficer} />
        </div>
      </div>
      {#if data.canEditDraft && data.version.name_certified !== 1}
        <label class="flex gap-8" style="align-items:flex-start">
          <input type="checkbox" name="certified" value="true" style="margin-top:3px" />
          <span>I confirm this name matches the passport exactly. If it does not, this request may be returned or cancelled.</span>
        </label>
        <button class="btn btn-primary mt-16" type="submit">Confirm name</button>
      {/if}
    </form>

    {#if data.isOfficer}
      <div class="divider"></div>
      <h3>Correct name (officer)</h3>
      <form method="POST" action="?/editName">
        <div class="form-row">
          <div class="field"><label>Primary identifier</label><input class="input" name="primary" value={data.version.name_primary || ''} /></div>
          <div class="field"><label>Secondary identifier</label><input class="input" name="secondary" value={data.version.name_secondary || ''} /></div>
        </div>
        <div class="field"><label>Reason (required, recorded in history)</label><textarea class="input" name="reason" required></textarea></div>
        <button class="btn btn-danger" type="submit">Record correction</button>
      </form>
    {/if}

    {#if data.nameEdits.length}
      <div class="divider"></div>
      <h3>Name change history</h3>
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
                <td class="muted">{new Date(e.created_at).toISOString().slice(0, 10)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Manual fields -->
  <div class="card mt-24">
    <div class="card-title">3 · Visa &amp; insurance</div>
    {#if form?.draftOk}<div class="alert alert-success">Saved.</div>{/if}
    <form method="POST" action="?/updateDraft">
      <div class="form-row-3">
        <div class="field"><label>Visa start date</label><input class="input" type="date" name="visa_start_date" value={data.version.visa_start_date || ''} /></div>
        <div class="field"><label>Visa entry date</label><input class="input" type="date" name="visa_entry_date" value={data.version.visa_entry_date || ''} /></div>
        <div class="field"><label>Last allowed stay</label><input class="input" type="date" name="visa_last_allowed_date" value={data.version.visa_last_allowed_date || ''} /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Phone (in country)</label><input class="input" name="phone" value={data.version.phone || ''} /></div>
        <div class="field"><label>Insurance company</label><input class="input" name="insurance_company" value={data.version.insurance_company || ''} /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Insurance start</label><input class="input" type="date" name="insurance_start_date" value={data.version.insurance_start_date || ''} /></div>
        <div class="field"><label>Insurance end</label><input class="input" type="date" name="insurance_end_date" value={data.version.insurance_end_date || ''} /></div>
      </div>
      <button class="btn btn-secondary" type="submit" disabled={!data.canEditDraft}>Save</button>
    </form>
  </div>

  <!-- Documents -->
  <div class="card mt-24">
    <div class="card-title">4 · Required documents</div>
    {#if form?.docError}<div class="alert alert-error">{form.docError}</div>{/if}
    {#if form?.docOk}<div class="alert alert-success">Document uploaded.</div>{/if}
    <ul class="checklist">
      {#each data.checklist as item (item.key)}
        <li class:ok={item.present}>
          <span class="dot">{item.present ? '✓' : ''}</span>
          <span style="flex:1"><strong>{item.key}</strong>{#if item.doc} <span class="caption">· {item.doc.file_name}</span>{/if}</span>
          {#if !item.present}
            <form method="POST" action="?/uploadDoc" enctype="multipart/form-data" style="margin:0;display:flex;gap:8px">
              <input type="hidden" name="docKey" value={item.key} />
              <input class="input" style="padding:6px" type="file" name="file" required />
              <button class="btn btn-secondary btn-sm" type="submit">Upload</button>
            </form>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
</div>
