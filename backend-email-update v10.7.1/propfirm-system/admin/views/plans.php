<?php defined('ABSPATH') || exit; ?>
<div class="wrap fxsim-admin">
  <h1>Challenge Plans <button class="button button-primary" onclick="fxsimAdmin.newPlan()">+ New Plan</button></h1>
  <table class="wp-list-table widefat fixed striped" id="fxsim-plans-table">
    <thead><tr>
      <th>Name</th><th>Size</th><th>Price</th><th>P1 Target</th><th>P1 Daily DD</th>
      <th>P1 Max DD</th><th>P2 Target</th><th>Split</th><th>Active</th><th>Actions</th>
    </tr></thead>
    <tbody id="fxsim-plans-body"><tr><td colspan="10">Loading…</td></tr></tbody>
  </table>

  <!-- Edit/Create Plan Modal -->
  <div id="fxsim-plan-modal" class="fxsim-modal" style="display:none">
    <div class="fxsim-modal-box" style="max-width:680px">
      <h3 id="fxsim-plan-modal-title">Plan</h3>
      <input type="hidden" id="plan-id" value="0">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px">
        <label>Name<br><input type="text" id="plan-name" class="regular-text" placeholder="e.g. Starter Challenge"></label>
        <label>Account Size ($)<br><input type="number" id="plan-size" value="10000" step="1000"></label>
        <label>Price ($)<br><input type="number" id="plan-price" value="99" step="1"></label>
        <label>Phases<br><select id="plan-phases" onchange="fxsimTogglePlanFields()"><option value="1">1 Phase</option><option value="2" selected>2 Phases</option><option value="3">3 Phases</option></select></label>
        <label>Challenge Type (Instant Funding)<br>
          <select id="plan-is-instant-funding" onchange="fxsimTogglePlanFields()">
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
          <br><small style="font-weight:normal;color:#666">If enabled, buyer gets a funded account immediately (no evaluation phases)</small>
        </label>
        <label>Drawdown Type<br>
          <select id="plan-drawdown-type">
            <option value="static">Static - Balance Based</option>
            <option value="trailing">Trailing - Equity HWM</option>
            <option value="eod_trailing">EOD Trailing - End of Day</option>
          </select>
          <br><small style="font-weight:normal;color:#666">Static: Fixed limit from initial balance. Trailing: Follows highest equity. EOD Trailing: Calculated at end of trading day.</small>
        </label>

        <label class="phase1-field">P1 Profit Target (%)<br><input type="number" id="plan-p1pt" value="8" step="0.5"></label>
        <label class="phase1-field">P1 Daily DD (%)<br><input type="number" id="plan-p1dd" value="5" step="0.5"></label>
        <label class="phase1-field">P1 Max DD (%)<br><input type="number" id="plan-p1mdd" value="10" step="0.5"></label>
        <label class="phase1-field">P1 Min Days<br><input type="number" id="plan-p1min" value="5"></label>
        <label class="phase1-field">P1 Max Days<br><input type="number" id="plan-p1max" value="30"></label>

        <label class="phase2-field">P2 Profit Target (%)<br><input type="number" id="plan-p2pt" value="5" step="0.5"></label>
        <label class="phase2-field">P2 Daily DD (%)<br><input type="number" id="plan-p2dd" value="5" step="0.5"></label>
        <label class="phase2-field">P2 Max DD (%)<br><input type="number" id="plan-p2mdd" value="10" step="0.5"></label>
        <label class="phase2-field">P2 Min Days<br><input type="number" id="plan-p2min" value="5"></label>
        <label class="phase2-field">P2 Max Days<br><input type="number" id="plan-p2max" value="60"></label>

        <label class="phase3-field">P3 Profit Target (%)<br><input type="number" id="plan-p3pt" value="5" step="0.5"></label>
        <label class="phase3-field">P3 Daily DD (%)<br><input type="number" id="plan-p3dd" value="5" step="0.5"></label>
        <label class="phase3-field">P3 Max DD (%)<br><input type="number" id="plan-p3mdd" value="10" step="0.5"></label>
        <label class="phase3-field">P3 Min Days<br><input type="number" id="plan-p3min" value="5"></label>
        <label class="phase3-field">P3 Max Days<br><input type="number" id="plan-p3max" value="60"></label>

        <label>Funded Profit Split (%)<br><input type="number" id="plan-split" value="80" step="1"></label>
        <label>Max Leverage<br><input type="number" id="plan-lev" value="100"></label>
        <label>Active<br><select id="plan-active"><option value="1">Yes</option><option value="0">No</option></select></label>
        <label>Sort Order<br><input type="number" id="plan-sort" value="0"></label>
        <label>Consistency Rule<br><select id="plan-consistency"><option value="0">Disabled</option><option value="1">Enabled</option></select></label>
        <label>Consistency % (max single day / total)<br><input type="number" id="plan-consistency-pct" value="50" step="1"></label>
        <label>News Trading<br><select id="plan-news-trading"><option value="1">Allowed</option><option value="0">Not Allowed</option></select></label>

        <div style="grid-column: 1 / -1; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
            <strong>Scaling Plan</strong>
        </div>
        <label>Enable Scaling<br>
          <select id="plan-scaling-enabled" onchange="fxsimTogglePlanFields()">
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </label>
        <label class="scaling-field">Growth % per scale<br><input type="number" id="plan-scaling-growth-pct" value="25" step="1"></label>
        <label class="scaling-field">Interval (months)<br><input type="number" id="plan-scaling-interval-months" value="4" step="1"></label>
        <label class="scaling-field">Required Profit %<br><input type="number" id="plan-scaling-required-profit-pct" value="10" step="1"></label>
        <label class="scaling-field">Max Balance Cap ($)<br><input type="number" id="plan-scaling-max-balance" value="2000000" step="1000"></label>
      </div>
      <br>
      <button class="button button-primary" onclick="fxsimAdmin.savePlan()">Save Plan</button>
      <button class="button" onclick="document.getElementById('fxsim-plan-modal').style.display='none'">Cancel</button>
      <div id="fxsim-plan-msg" style="margin-top:8px;color:green"></div>
    </div>
  </div>
</div>

<script>
function fxsimTogglePlanFields() {
    const instantSelect = document.getElementById('plan-is-instant-funding');
    const phasesSelect = document.getElementById('plan-phases');
    const scalingSelect = document.getElementById('plan-scaling-enabled');
    
    if (!instantSelect || !phasesSelect || !scalingSelect) return;

    const isInstant = instantSelect.value == '1';
    const phases = parseInt(phasesSelect.value);
    const scaling = scalingSelect.value == '1';

    const p1Fields = document.querySelectorAll('.phase1-field');
    const p2Fields = document.querySelectorAll('.phase2-field');
    const p3Fields = document.querySelectorAll('.phase3-field');
    
    const phasesLabel = phasesSelect.closest('label');

    if (isInstant) {
        if(phasesLabel) phasesLabel.style.display = 'none';
        p1Fields.forEach(el => el.style.display = 'none');
        p2Fields.forEach(el => el.style.display = 'none');
        p3Fields.forEach(el => el.style.display = 'none');
    } else {
        if(phasesLabel) phasesLabel.style.display = 'block';
        p1Fields.forEach(el => el.style.display = 'block');
        p2Fields.forEach(el => el.style.display = (phases >= 2) ? 'block' : 'none');
        p3Fields.forEach(el => el.style.display = (phases >= 3) ? 'block' : 'none');
    }

    const scalingFields = document.querySelectorAll('.scaling-field');
    scalingFields.forEach(el => el.style.display = scaling ? 'block' : 'none');
}

document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('fxsim-plan-modal');
    if (modal) {
        const observer = new MutationObserver(function() {
            if (modal.style.display !== 'none') {
                fxsimTogglePlanFields();
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
    }
    fxsimTogglePlanFields();
});
</script>
