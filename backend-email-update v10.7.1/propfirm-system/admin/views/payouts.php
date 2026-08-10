<?php defined('ABSPATH') || exit; ?>
<div class="wrap fxsim-admin">
  <h1>Payout Requests</h1>

  <div class="fxsim-admin-toolbar" style="margin-bottom:16px">
    <button class="button button-primary" onclick="fxsimAdmin.loadPayouts()">↺ Refresh</button>
    <button class="button" onclick="fxsimAdmin.exportPayoutsCSV()">⬇ Export CSV</button>
    <select id="payout-filter" style="margin-left:8px" onchange="fxsimAdmin.loadPayouts()">
      <option value="pending">Pending</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
      <option value="">All</option>
    </select>
    <button class="button" id="btn-bulk-payout" style="margin-left:auto; background:#6c63ff; color:#fff; border:none; font-weight:600;" onclick="fxsimAdmin.bulkApprovePayouts()">⚡ Auto-Validate & Bulk Approve Pending</button>
  </div>

  <table class="wp-list-table widefat fixed striped" id="fxsim-payouts-table">
    <thead><tr>
      <th style="width:50px">ID</th>
      <th>Trader</th>
      <th>Challenge</th>
      <th>Trader Amount</th>
      <th>Split %</th>
      <th>Method</th>
      <th>Address / Details</th>
      <th>Requested</th>
      <th>Status</th>
      <th style="width:220px">Actions</th>
    </tr></thead>
    <tbody id="fxsim-payouts-body"><tr><td colspan="10">Loading…</td></tr></tbody>
  </table>

  <!-- Approve/reject modal -->
  <div class="fxsim-modal" id="payout-action-modal" style="display:none">
    <div class="fxsim-modal-box" style="min-width:440px">
      <h3 id="payout-modal-title">Process Payout</h3>
      <input type="hidden" id="payout-modal-id">
      <input type="hidden" id="payout-modal-action">
      <div style="display:grid;gap:12px">
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px">Payment Reference <small style="color:#888">(Wise txn ID, PayPal ref, etc.)</small></label>
          <input type="text" id="payout-reference" class="large-text" placeholder="Optional — shown in trader email">
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px">Admin Note</label>
          <textarea id="payout-note" rows="2" class="large-text" placeholder="Internal note or reason for rejection…"></textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="button button-primary" id="payout-confirm-btn" onclick="fxsimAdmin.confirmPayoutAction()">Confirm</button>
        <button class="button" onclick="document.getElementById('payout-action-modal').style.display='none'">Cancel</button>
      </div>
      <div id="payout-modal-msg" style="margin-top:8px;font-size:13px;font-weight:600"></div>
    </div>
  </div>
</div>
