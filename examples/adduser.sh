curl $ENDPOINT \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
--data-binary '{"query":"mutation ($username: String!, $password: String!) {  userSignUp(inputs: { username: $username, password: $password }) { id username }}","variables":{"username":"'"${SIGNUP_USERNAME:-$USERNAME}"'","password":"'"${SIGNUP_PASSWORD:-$PASSWORD}"'"}}' --compressed

