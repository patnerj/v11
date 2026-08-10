<?php defined('ABSPATH') || exit; ?>
<div class="wrap fxsim-admin">
  <h1>Payment Orders</h1>

  <div style="display:flex;gap:8px;margin-bottom:16px">
    <button class="button <?php echo !isset($_GET['status']) || $_GET['status']==='pending' ? 'button-primary' : '' ?>"
      onclick="fxsimAdmin.filterPayments('pending')">⏳ Pending</button>
    <button class="button <?php echo isset($_GET['status']) && $_GET['status']==='approved' ? 'button-primary' : '' ?>"
      onclick="fxsimAdmin.filterPayments('approved')">✅ Approved</button>
    <button class="button <?php echo isset($_GET['status']) && $_GET['status']==='rejected' ? 'button-primary' : '' ?>"
      onclick="fxsimAdmin.filterPayments('rejected')">❌ Rejected</button>
    <button class="button" onclick="fxsimAdmin.filterPayments('all')">All</button>
  </div>

  <table class="wp-list-table widefat fixed striped" id="fxsim-payments-table">
    <thead>
      <tr>
        <th style="width:50px">ID</th>
        <th>User</th>
        <th>Plan</th>
        <th style="width:80px">Amount</th>
        <th style="width:80px">Gateway</th>
        <th style="width:80px">Status</th>
        <th>Payment Proof</th>
        <th>Notes</th>
        <th>Submitted</th>
        <th style="width:160px">Actions</th>
      </tr>
    </thead>
    <tbody id="fxsim-payments-body">
      <tr><td colspan="10">Loading…</td></tr>
    </tbody>
  </table>

  <!-- Proof preview lightbox -->
  <div id="fxsim-proof-lightbox"
       style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;
              align-items:center;justify-content:center;cursor:pointer"
       onclick="this.style.display='none'">
    <img id="fxsim-proof-img" src="" alt="Payment Proof"
         style="max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.8)">
  </div>

  <!-- Reject reason modal -->
  <div id="fxsim-reject-modal" class="fxsim-modal" style="display:none">
    <div class="fxsim-modal-box">
      <h3>Reject Payment</h3>
      <p>Order ID: <strong id="reject-order-id"></strong></p>
      <label>Reason for rejection:<br>
        <textarea id="reject-note" rows="3" style="width:100%;margin-top:4px;padding:6px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px"
                  placeholder="e.g. Screenshot unclear, wrong amount, etc."></textarea>
      </label>
      <br><br>
      <button class="button button-primary" onclick="fxsimAdmin.submitReject()">Confirm Rejection</button>
      <button class="button" onclick="document.getElementById('fxsim-reject-modal').style.display='none'">Cancel</button>
    </div>
  </div>
</div>
