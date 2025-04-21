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
import { t } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import FormModal from 'src/components/Modal/FormModal';
import { FormItem } from 'src/components/Form';
import { Input } from 'src/components/Input';
import Checkbox from 'src/components/Checkbox';
import Select from 'src/components/Select/Select';
import { Role, UserObject } from 'src/pages/UsersList';
import { FormInstance } from 'src/components';
import { BaseUserListModalProps, FormValues } from './types';
import { createUser, updateUser } from './utils';

export interface UserModalProps extends BaseUserListModalProps {
  roles: Role[];
  isEditMode?: boolean;
  user?: UserObject;
}

function UserListModal({
  show,
  onHide,
  onSave,
  roles,
  isEditMode = false,
  user,
}: UserModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const handleFormSubmit = async (values: FormValues) => {
    const handleError = async (err: any, action: 'create' | 'update') => {
      let errorMessage =
        action === 'create'
          // ? t('Error while adding user!')
          // : t('Error while updating user!');
          ? t('添加用户时出错！')
          : t('更新用户时出错！');

      if (err.status === 422) {
        const errorData = await err.json();
        const detail = errorData?.message || '';

        if (detail.includes('duplicate key value')) {
          if (detail.includes('ab_user_username_key')) {
            // errorMessage = t(
            //   'This username is already taken. Please choose another one.',
            // );
            errorMessage = t(
              '这个用户名已被占用，请选择另一个。',
            );
          } else if (detail.includes('ab_user_email_key')) {
            // errorMessage = t(
            //   'This email is already associated with an account.',
            // );
            errorMessage = t(
              '此电子邮件已与帐户关联。',
            );
          }
        }
      }

      addDangerToast(errorMessage);
      throw err;
    };

    if (isEditMode) {
      if (!user) {
        // throw new Error('User is required in edit mode');
        throw new Error('在编辑模式下需要用户');
      }
      try {
        await updateUser(user.id, values);
        // addSuccessToast(t('User was successfully updated!'));
        addSuccessToast(t('用户信息已成功更新！'));
      } catch (err) {
        await handleError(err, 'update');
      }
    } else {
      try {
        await createUser(values);
        // addSuccessToast(t('User was successfully created!'));
        addSuccessToast(t('用户成功创建！'));
      } catch (err) {
        await handleError(err, 'create');
      }
    }
  };

  const requiredFields = isEditMode
    ? ['first_name', 'last_name', 'username', 'email', 'roles']
    : [
        'first_name',
        'last_name',
        'username',
        'email',
        'password',
        'roles',
        'confirmPassword',
      ];

  const initialValues = {
    ...user,
    roles: user?.roles.map(role => role.id) || [],
  };

  return (
    <FormModal
      show={show}
      onHide={onHide}
      // title={isEditMode ? t('Edit User') : t('Add User')}
      title={isEditMode ? t('修改用户') : t('添加用户')}
      onSave={onSave}
      formSubmitHandler={handleFormSubmit}
      requiredFields={requiredFields}
      initialValues={initialValues}
    >
      {(form: FormInstance) => (
        <>
          <FormItem
            name="first_name"
            // label={t('First name')}
            label={t('名字')}
            // rules={[{ required: true, message: t('First name is required') }]}
            rules={[{ required: true, message: t('名字是必填的') }]}
          >
            <Input
              name="first_name"
              // placeholder={t("Enter the user's first name")}
              placeholder={t("输入用户的名字")}
            />
          </FormItem>
          <FormItem
            name="last_name"
            // label={t('Last name')}
            label={t('姓氏')}
            // rules={[{ required: true, message: t('Last name is required') }]}
            rules={[{ required: true, message: t('姓氏是必填的') }]}
          >
            <Input
              name="last_name"
              // placeholder={t("Enter the user's last name")}
              placeholder={t("输入用户的姓氏")}
            />
          </FormItem>
          <FormItem
            name="username"
            // label={t('Username')}
            // rules={[{ required: true, message: t('Username is required') }]}
            label={t('用户名')}
            rules={[{ required: true, message: t('用户名是必填的') }]}
          >
            <Input
              name="username"
              // placeholder={t("Enter the user's username")}
              placeholder={t("输入用户名")}
            />
          </FormItem>
          <FormItem
            name="active"
            // label={t('Is active?')}
            label={t('是活跃的？')}
            valuePropName="checked"
          >
            <Checkbox
              onChange={checked => {
                form.setFieldsValue({ isActive: checked });
              }}
            />
          </FormItem>
          <FormItem
            name="email"
            // label={t('Email')}
            label={t('电子邮件')}
            rules={[
              // { required: true, message: t('Email is required') },
              // {
              //   type: 'email',
              //   message: t('Please enter a valid email address'),
              // },
              { required: true, message: t('电子邮件是必需的') },
              {
                type: 'email',
                message: t('请输入有效的电子邮件地址'),
              },
            ]}
          >
            {/* <Input name="email" placeholder={t("Enter the user's email")} /> */}
            <Input name="email" placeholder={t("输入用户的电子邮件")} />
          </FormItem>
          <FormItem
            name="roles"
            // label={t('Roles')}
            label={t('角色')}
            // rules={[{ required: true, message: t('Role is required') }]}
            rules={[{ required: true, message: t('角色是必填的') }]}
          >
            <Select
              name="roles"
              mode="multiple"
              // placeholder={t('Select roles')}
              placeholder={t('选择角色')}
              options={roles.map(role => ({
                value: role.id,
                label: role.name,
              }))}
              getPopupContainer={trigger =>
                trigger.closest('.antd5-modal-content')
              }
            />
          </FormItem>

          {!isEditMode && (
            <>
              <FormItem
                name="password"
                // label={t('Password')}
                label={t('密码')}
                // rules={[{ required: true, message: t('Password is required') }]}
                rules={[{ required: true, message: t('密码是必填的') }]}
              >
                <Input.Password
                  name="password"
                  // placeholder="Enter the user's password"
                   placeholder="输入用户密码"
                />
              </FormItem>
              <FormItem
                name="confirmPassword"
                // label={t('Confirm Password')}
                label={t('确认密码')}
                dependencies={['password']}
                rules={[
                  {
                    required: true,
                    // message: t('Please confirm your password'),
                    message: t('请确认密码'),
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        // new Error(t('Passwords do not match!')),
                        new Error(t('密码不匹配！')),
                      );
                    },
                  }),
                ]}
              >
                <Input.Password
                  name="confirmPassword"
                  // placeholder={t("Confirm the user's password")}
                  placeholder={t("确认用户密码")}
                />
              </FormItem>
            </>
          )}
        </>
      )}
    </FormModal>
  );
}

export const UserListAddModal = (
  props: Omit<UserModalProps, 'isEditMode' | 'initialValues'>,
) => <UserListModal {...props} isEditMode={false} />;

export const UserListEditModal = (
  props: Omit<UserModalProps, 'isEditMode'> & { user: UserObject },
) => <UserListModal {...props} isEditMode />;

export default UserListModal;
