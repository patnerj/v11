<?php defined('ABSPATH') || exit; ?>
<div class="wrap fxsim-admin">
  <h1>Users</h1>
  <div class="fxsim-admin-toolbar">
    <input type="text" id="fxsim-user-search" placeholder="Search username or email…" class="regular-text">
    <button class="button" onclick="fxsimAdmin.searchUsers()">Search</button>
  </div>
  <table class="wp-list-table widefat fixed striped" id="fxsim-users-table">
    <thead><tr>
      <th style="width:50px">ID</th>
      <th>Username</th>
      <th>Email</th>
      <th>Balance</th>
      <th>Equity</th>
      <th>Challenges</th>
      <th>Joined</th>
      <th>Status</th>
      <th>Actions</th>
    </tr></thead>
    <tbody id="fxsim-users-body"><tr><td colspan="9">Loading…</td></tr></tbody>
  </table>
  <!-- Balance Adjust Modal -->
  <div id="fxsim-adjust-modal" class="fxsim-modal" style="display:none">
    <div class="fxsim-modal-box">
      <h3>Adjust Balance</h3>
      <p>User: <strong id="modal-username"></strong></p>
      <label>Amount (positive = deposit, negative = withdrawal):<br>
        <input type="number" id="modal-amount" step="0.01" placeholder="e.g. 500 or -200">
      </label><br><br>
      <label>Note:<br><input type="text" id="modal-note" placeholder="Reason…"></label><br><br>
      <button class="button button-primary" onclick="fxsimAdmin.submitAdjust()">Apply</button>
      <button class="button" onclick="document.getElementById('fxsim-adjust-modal').style.display='none'">Cancel</button>
      <input type="hidden" id="modal-user-id">
    </div>
  </div>
</div>
