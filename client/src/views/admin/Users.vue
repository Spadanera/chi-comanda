<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { type User } from '../../../../models/src'
import Axios from '@/services/client'
import { copy, requiredRule, emailRule, Roles } from '@/services/utils'
import Avatar from '@/components/Avatar.vue'

const axios = new Axios()
const loading = ref<boolean>(null)
const dialog = ref<boolean>(null)
const filter = ref<string>(null)
const confirm = ref<boolean>(null)
const confirmDelete = ref<boolean>(null)
const users = ref<User[]>([])
const selectedUser = ref<User>(null)
const form = ref(null)
const roleOptions = Object.values(Roles).filter((r: Roles) => r !== Roles.client)
const fidelityClient = ref<boolean>(false)
const selectedRoles = ref([])

function formatedRole(role: string) {
  switch (role) {
    case Roles.admin:
      return "Amministratore"
    case Roles.waiter:
      return "Cameriere"
    case Roles.checkout:
      return "Cassiere"
    case Roles.bartender:
      return "Barista"
    case Roles.client:
      return "Cliente Fedele"
    case Roles.superuser:
      return "Super User"
  }
}

const customSelectRule = (value: any) => {
  if (value?.length === 0 && !fidelityClient.value) {
    return 'Inserire un valore'
  } else {
    return true
  }
}

const filteredUsers = computed(() => {
  const reg = new RegExp(filter.value, "i")
  return users.value.filter((u: User) => !filter.value || reg.test(u.email) || reg.test(u.username)).map((u: User) => {
    return {
      ...u,
      statusSwitch: u.status === 'ACTIVE'
    }
  })
})

function getColorByRole(role: string): string {
  if (role === Roles.superuser) return 'primary'
  if (role === Roles.client) return 'green'
  return ''
}

function openDialog(user?: User) {
  if (user) {
    selectedUser.value = copy<User>(user)
  }
  else {
    selectedUser.value = {

    } as User
  }
  if (selectedUser.value.roles?.includes(Roles.client)) {
    fidelityClient.value = true
  }
  else {
    fidelityClient.value = false
  }
  selectedRoles.value = selectedUser.value.roles?.filter((r) => r !== Roles.client)
  dialog.value = true
}

function updateUserStatusConfirm(user: User) {
  selectedUser.value = user
  confirm.value = true
}

async function updateUserStatus() {
  const _user = copy<User>(selectedUser.value)
  _user.status = _user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'
  delete _user.avatar
  await axios.UpdateUser(_user)
  await getUsers()
  confirm.value = false
}

async function deleteConfirm() {
  confirmDelete.value = true
}

async function deleteUser() {
  await axios.DeleteUser(selectedUser.value.id)
  await getUsers()
  confirmDelete.value = false
  dialog.value = false
}

async function updateUserRole() {
  const { valid } = await form.value?.validate()
  if (valid) {
    if (fidelityClient.value) {
      selectedUser.value.roles = [Roles.client]
    }
    else {
      selectedUser.value.roles = selectedRoles.value
    }
    const _user: User = {
      id: selectedUser.value.id,
      roles: selectedUser.value.roles
    } as User
    await axios.UpdateUserRoles(_user)
    await getUsers()
    dialog.value = false
  }
}

async function inviteUser() {
  const { valid } = await form.value?.validate()
  if (valid) {
    if (fidelityClient.value) {
      selectedUser.value.roles = [Roles.client]
    }
    else {
      selectedUser.value.roles = selectedRoles.value
    }
    await axios.InviteUser(selectedUser.value)
    await getUsers()
    dialog.value = false
  }
}

async function getUsers() {
  users.value = await axios.GetUsers()
}

onMounted(async () => {
  loading.value = true
  await getUsers()
  loading.value = false
})
</script>
<template>
  <v-skeleton-loader v-if="loading" type="list-item-three-line"></v-skeleton-loader>
  <div v-else>
    <v-text-field :clearable="true" v-model="filter" label="Cerca"></v-text-field>
    <v-table density="compact">
      <thead>
        <tr>
          <th class="text-left">
            Avatar
          </th>
          <th class="text-left">
            Nome Utente
          </th>
          <th class="text-left">
            Email
          </th>
          <th class="text-left">
            Ruoli
          </th>
          <th>
            Stato
          </th>
        </tr>
      </thead>
      <tbody style="cursor: pointer;">
        <tr v-for="user in filteredUsers" :key="user.id" @click="openDialog(user)">
          <td>
            <Avatar :user="user" alt size="small"></Avatar>
          </td>
          <td>{{ user.username }}</td>
          <td>{{ user.email }}</td>
          <td>
            <v-chip :color="getColorByRole(role)" v-for="role in user.roles">{{ formatedRole(role) }}</v-chip>
          </td>
          <td>
            <v-switch v-if="['ACTIVE', 'BLOCKED'].includes(user.status)" color="green"
              :disabled="user.roles?.includes(Roles.superuser)" v-model:model-value="user.statusSwitch"
              @click.stop="updateUserStatusConfirm(user)"></v-switch>
            <span v-else>Invitato</span>
          </td>
        </tr>
      </tbody>
    </v-table>
    <v-dialog v-model="dialog" width="400px">
      <v-card>
        <v-card-title v-if="selectedUser.id">
          Modifica ruoli utente
        </v-card-title>
        <v-card-title v-else>
          Invita Nuovo Utente
        </v-card-title>
        <v-card-text>
          <v-form ref="form" @submit.prevent>
            <v-row>
              <v-col cols="12">
                <v-text-field :readonly="selectedUser.id > 0" v-model="selectedUser.email" label="Email" type="email"
                  :rules="[requiredRule, emailRule]"></v-text-field>
              </v-col>
            </v-row>
            <v-row v-show="!fidelityClient">
              <v-col>
                <v-select label="Ruoli" v-model="selectedRoles" :items="roleOptions" multiple
                  :rules="[customSelectRule]">
                  <template v-slot:item="{ props, item }">
                    <v-list-item v-bind="props" :title="formatedRole(item.title)"></v-list-item>
                  </template>
                  <template v-slot:selection="{ item }">
                    <v-chip>
                      <span>{{ formatedRole(item.title) }}</span>
                    </v-chip>
                  </template>
                </v-select>
              </v-col>
            </v-row>
            <!-- <v-row>
              <v-col>
                <v-switch color="green" label="Cliente Fidato" v-model="fidelityClient" :rules="[]"></v-switch>
              </v-col>
            </v-row> -->
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="plain" @click="dialog = false">ANNULLA</v-btn>
          <v-btn color="red" v-if="selectedUser.id && !selectedUser.roles?.includes(Roles.superuser)" variant="plain"
            @click="deleteConfirm()">ELIMINA</v-btn>
          <v-btn v-if="selectedUser.id" variant="plain" @click="updateUserRole()">AGGIORNA RUOLI</v-btn>
          <v-btn v-else variant="plain" @click="inviteUser()">INVITA</v-btn>
        </v-card-actions>
      </v-card>
      <Confirm v-model="confirmDelete">
        <template v-slot:action>
          <v-btn text="Conferma" variant="plain" @click="deleteUser()"></v-btn>
        </template>
      </Confirm>
    </v-dialog>
    <Confirm v-model="confirm">
      <template v-slot:action>
        <v-btn text="Conferma" variant="plain" @click="updateUserStatus()"></v-btn>
      </template>
    </Confirm>
  </div>
  <v-fab icon="mdi-plus" app style="position: fixed; right: 10px; bottom: 10px;" location="bottom right"
    @click="openDialog"></v-fab>
</template>
