function findActiveUsers(users) {
  const result = users.filter(user => user.active);
  return result;
}
