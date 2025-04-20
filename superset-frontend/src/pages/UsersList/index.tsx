/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { css, t, SupersetClient, useTheme } from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import DeleteModal from 'src/components/DeleteModal';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import { Icons } from 'src/components/Icons';
import {
  UserListAddModal,
  UserListEditModal,
} from 'src/features/users/UserListModal';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { deleteUser } from 'src/features/users/utils';

const PAGE_SIZE = 25;

interface UsersListProps {
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
    roles: object;
  };
}

export type Role = {
  id: number;
  name: string;
};

export type UserObject = {
  active: boolean;
  changed_by: string | null;
  changed_on: string;
  created_by: string | null;
  created_on: string;
  email: string;
  fail_login_count: number;
  first_name: string;
  id: number;
  last_login: string;
  last_name: string;
  login_count: number;
  roles: Role[];
  username: string;
};

enum ModalType {
  ADD = 'add',
  EDIT = 'edit',
}

const isActiveOptions = [
  // {
  //   label: 'Yes',
  //   value: true,
  // },
  // {
  //   label: 'No',
  //   value: false,
  // },
  {
    label: '是',
    value: true,
  },
  {
    label: '否',
    value: false,
  },
];

function UsersList({ user }: UsersListProps) {
  const theme = useTheme();
  const { addDangerToast, addSuccessToast } = useToasts();
  const {
    state: {
      loading,
      resourceCount: usersCount,
      resourceCollection: users,
      bulkSelectEnabled,
    },
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<UserObject>(
    'security/users',
    // t('User'),
    t('用户'),
    addDangerToast,
  );
  const [modalState, setModalState] = useState({
    edit: false,
    add: false,
    duplicate: false,
  });
  const openModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: true }));
  const closeModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: false }));

  const [currentUser, setCurrentUser] = useState<UserObject | null>(null);
  const [userCurrentlyDeleting, setUserCurrentlyDeleting] =
    useState<UserObject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const loginCountStats = useMemo(() => {
    if (!users || users.length === 0) return { min: 0, max: 0 };

    const loginCounts = users.map(user => user.login_count);
    return {
      min: Math.min(...loginCounts),
      max: Math.max(...loginCounts),
    };
  }, [users]);
  const failLoginCountStats = useMemo(() => {
    if (!users || users.length === 0) return { min: 0, max: 0 };

    const failLoginCounts = users.map(user => user.fail_login_count);
    return {
      min: Math.min(...failLoginCounts),
      max: Math.max(...failLoginCounts),
    };
  }, [users]);

  const isAdmin = useMemo(() => isUserAdmin(user), [user]);

  const fetchRoles = useCallback(async () => {
    try {
      const pageSize = 100;

      const fetchPage = async (pageIndex: number) => {
        const response = await SupersetClient.get({
          endpoint: `api/v1/security/roles/?q=(page_size:${pageSize},page:${pageIndex})`,
        });
        return response.json;
      };

      const initialResponse = await fetchPage(0);
      const totalRoles = initialResponse.count;
      const firstPageResults = initialResponse.result;

      if (pageSize >= totalRoles) {
        setRoles(firstPageResults);
        return;
      }

      const totalPages = Math.ceil(totalRoles / pageSize);

      const roleRequests = Array.from({ length: totalPages - 1 }, (_, i) =>
        fetchPage(i + 1),
      );
      const remainingResults = await Promise.all(roleRequests);

      setRoles([
        ...firstPageResults,
        ...remainingResults.flatMap(res => res.result),
      ]);
    } catch (err) {
      // addDangerToast(t('Error while fetching roles'));
      addDangerToast(t('获取角色时出错'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleUserDelete = async ({ id, username }: UserObject) => {
    try {
      await deleteUser(id);
      refreshData();
      setUserCurrentlyDeleting(null);
      // addSuccessToast(t('Deleted user: %s', username));
      addSuccessToast(t('已删除用户: %s', username));
    } catch (error) {
      // addDangerToast(t('There was an issue deleting %s', username));
      addDangerToast(t('删除时出现问题 %s', username));
    }
  };

  const handleBulkUsersDelete = (usersToDelete: UserObject[]) => {
    const deletedUserNames: string[] = [];

    Promise.all(
      usersToDelete.map(user =>
        deleteUser(user.id)
          .then(() => {
            deletedUserNames.push(user.username);
          })
          .catch(err => {
            // addDangerToast(t('Error deleting %s', user.username));
            addDangerToast(t('删除时出错 %s', user.username));
          }),
      ),
    )
      .then(() => {
        if (deletedUserNames.length > 0) {
          // addSuccessToast(t('Deleted users: %s', deletedUserNames.join(', ')));
          addSuccessToast(t('已删除用户: %s', deletedUserNames.join(', ')));
        }
      })
      .finally(() => {
        refreshData();
      });
  };

  const initialSort = [{ id: 'username', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'first_name',
        // Header: t('First name'),
        Header: t('名字'),
        Cell: ({
          row: {
            original: { first_name },
          },
        }: any) => <span>{first_name}</span>,
      },
      {
        accessor: 'last_name',
        // Header: t('Last name'),
        Header: t('姓氏'),
        Cell: ({
          row: {
            original: { last_name },
          },
        }: any) => <span>{last_name}</span>,
      },
      {
        accessor: 'username',
        // Header: t('Username'),
        Header: t('用户名'),
        Cell: ({
          row: {
            original: { username },
          },
        }: any) => <span>{username}</span>,
      },
      {
        accessor: 'email',
        // Header: t('Email'),
        Header: t('电子邮件'),
        Cell: ({
          row: {
            original: { email },
          },
        }: any) => <span>{email}</span>,
      },
      {
        accessor: 'active',
        // Header: t('Is active?'),
        Header: t('是活跃的？'),
        // Cell: ({
        //   row: {
        //     original: { active },
        //   },
        // }: any) => <span>{active ? 'Yes' : 'No'}</span>,
        Cell: ({
          row: {
            original: { active },
          },
        }: any) => <span>{active ? '是' : '否'}</span>,
      },
      {
        accessor: 'roles',
        // Header: t('Roles'),
        Header: t('角色'),
        Cell: ({
          row: {
            original: { roles },
          },
        }: any) => (
          <span>{roles.map((role: Role) => role.name).join(', ')}</span>
        ),
        disableSortBy: true,
      },
      {
        accessor: 'login_count',
        // Header: t('Login count'),
        Header: t('登录次数'),
        hidden: true,
        Cell: ({ row: { original } }: any) => original.login_count,
      },
      {
        accessor: 'fail_login_count',
        // Header: t('Fail login count'),
        Header: t('登录失败计数'),
        hidden: true,
        Cell: ({ row: { original } }: any) => original.fail_login_count,
      },
      {
        accessor: 'created_on',
        // Header: t('Created on'),
        Header: t('创建于'),
        hidden: true,
        Cell: ({
          row: {
            original: { created_on },
          },
        }: any) => created_on,
      },
      {
        accessor: 'changed_on',
        // Header: t('Changed on'),
        Header: t('更改于'),
        hidden: true,
        Cell: ({
          row: {
            original: { changed_on },
          },
        }: any) => changed_on,
      },
      {
        accessor: 'last_login',
        // Header: t('Last login'),
        Header: t('上次登录'),
        hidden: true,
        Cell: ({
          row: {
            original: { last_login },
          },
        }: any) => last_login,
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => {
            setCurrentUser(original);
            openModal(ModalType.EDIT);
          };
          const handleDelete = () => setUserCurrentlyDeleting(original);
          const actions = isAdmin
            ? [
                {
                  label: 'user-list-edit-action',
                  // tooltip: t('Edit user'),
                  tooltip: t('修改用户'),
                  placement: 'bottom',
                  icon: 'EditOutlined',
                  onClick: handleEdit,
                },
                {
                  label: 'role-list-delete-action',
                  // tooltip: t('Delete user'),
                  tooltip: t('删除用户'),
                  placement: 'bottom',
                  icon: 'DeleteOutlined',
                  onClick: handleDelete,
                },
              ]
            : [];

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        // Header: t('Actions'),
        Header: t('操作'),
        id: 'actions',
        disableSortBy: true,
        hidden: !isAdmin,
        size: 'xl',
      },
    ],
    [isAdmin],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (isAdmin) {
    subMenuButtons.push(
      {
        name: (
          <>
            <Icons.PlusOutlined
              iconColor={theme.colors.primary.light5}
              iconSize="m"
              css={css`
                margin: auto ${theme.gridUnit * 2}px auto 0;
                vertical-align: text-top;
              `}
            />
            {/* {t('User')} */}
            {t('用户')}
          </>
        ),
        buttonStyle: 'primary',
        onClick: () => {
          openModal(ModalType.ADD);
        },
        loading: isLoading,
        'data-test': 'add-user-button',
      },
      {
        // name: t('Bulk select'),
        name: t('批量选择'),
        onClick: toggleBulkSelect,
        buttonStyle: 'secondary',
      },
    );
  }

  const filters: Filters = useMemo(
    () => [
      {
        // Header: t('First name'),
        Header: t('名字'),
        key: 'first_name',
        id: 'first_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        // Header: t('Last name'),
        Header: t('姓氏'),
        key: 'last_name',
        id: 'last_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        // Header: t('Username'),
        Header: t('用户名'),
        key: 'username',
        id: 'username',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        // Header: t('Email'),
        Header: t('电子邮件'),
        key: 'email',
        id: 'email',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        // Header: t('Is active?'),
        Header: t('是活跃的？'),
        key: 'active',
        id: 'active',
        input: 'select',
        operator: FilterOperator.Equals,
        // unfilteredLabel: t('All'),
        unfilteredLabel: t('全部'),
        selects: isActiveOptions?.map(option => ({
          label: option.label,
          value: option.value,
        })),
        loading: isLoading,
      },
      {
        // Header: t('Roles'),
        Header: t('角色'),
        key: 'roles',
        id: 'roles',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        // unfilteredLabel: t('All'),
        unfilteredLabel: t('全部'),
        selects: roles?.map(role => ({
          label: role.name,
          value: role.id,
        })),
        loading: isLoading,
      },
      {
        // Header: t('Created on'),
        Header: t('创建于'),
        key: 'created_on',
        id: 'created_on',
        input: 'datetime_range',
        operator: FilterOperator.Between,
        dateFilterValueType: 'iso',
      },
      {
        // Header: t('Changed on'),
        Header: t('修改于'),
        key: 'changed_on',
        id: 'changed_on',
        input: 'datetime_range',
        operator: FilterOperator.Between,
        dateFilterValueType: 'iso',
      },
      {
        // Header: t('Last login'),
        Header: t('最后登录'),
        key: 'last_login',
        id: 'last_login',
        input: 'datetime_range',
        operator: FilterOperator.Between,
        dateFilterValueType: 'iso',
      },
      {
        // Header: t('Login count'),
        Header: t('登陆次数'),
        key: 'login_count',
        id: 'login_count',
        input: 'numerical_range',
        operator: FilterOperator.Between,
        min: loginCountStats.min,
        max: loginCountStats.max,
      },
      {
        // Header: t('Fail login count'),
        Header: t('登陆失败次数'),
        key: 'fail_login_count',
        id: 'fail_login_count',
        input: 'numerical_range',
        operator: FilterOperator.Between,
      },
    ],
    [isLoading, roles, loginCountStats, failLoginCountStats],
  );

  const emptyState = {
    // title: t('No users yet'),
    title: t('尚无用户'),
    image: 'filter-results.svg',
    ...(isAdmin && {
      buttonAction: () => {
        openModal(ModalType.ADD);
      },
      buttonText: (
        <>
          <Icons.PlusOutlined
            iconColor={theme.colors.primary.light5}
            iconSize="m"
            css={css`
              margin: auto ${theme.gridUnit * 2}px auto 0;
              vertical-align: text-top;
            `}
          />
          {/* {t('User')} */}
          {t('用户')}
        </>
      ),
    }),
  };

  return (
    <>
      {/* <SubMenu name={t('List Users')} buttons={subMenuButtons} /> */}
      <SubMenu name={t('用户列表')} buttons={subMenuButtons} />
      <UserListAddModal
        onHide={() => closeModal(ModalType.ADD)}
        show={modalState.add}
        onSave={() => {
          refreshData();
          closeModal(ModalType.ADD);
        }}
        roles={roles}
      />
      {modalState.edit && currentUser && (
        <UserListEditModal
          user={currentUser}
          show={modalState.edit}
          onHide={() => closeModal(ModalType.EDIT)}
          onSave={() => {
            refreshData();
            closeModal(ModalType.EDIT);
          }}
          roles={roles}
        />
      )}

      {userCurrentlyDeleting && (
        <DeleteModal
          // description={t('This action will permanently delete the user.')}
          description={t('此操作将永久删除用户。')}
          onConfirm={() => {
            if (userCurrentlyDeleting) {
              handleUserDelete(userCurrentlyDeleting);
            }
          }}
          onHide={() => setUserCurrentlyDeleting(null)}
          open
          // title={t('Delete User?')}
          title={t('删除用户？')}
        />
      )}
      <ConfirmStatusChange
        // title={t('Please confirm')}
        title={t('请确认')}
        // description={t('Are you sure you want to delete the selected users?')}
        description={t('您确定要删除已选用户吗？')}
        onConfirm={handleBulkUsersDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = isAdmin
            ? [
                {
                  key: 'delete',
                  // name: t('Delete'),
                  name: t('删除'),
                  onSelect: confirmDelete,
                  type: 'danger',
                },
              ]
            : [];

          return (
            <ListView<UserObject>
              className="user-list-view"
              columns={columns}
              count={usersCount}
              data={users}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              emptyState={emptyState}
              refreshData={refreshData}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default UsersList;
