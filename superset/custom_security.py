from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import AuthDBView
from flask import flash, redirect, request, url_for
from flask_appbuilder.security.forms import LoginForm_db
from flask_login import login_user
from flask_appbuilder.security.manager import LoginManager
from flask_appbuilder import expose

class CustomLoginView(AuthDBView):
    login_template = "appbuilder/general/security/login_db.html"

    @expose("/login/", methods=["GET", "POST"])
    def login(self):
        if request.method == "POST":
            form = LoginForm_db()
            if form.validate_on_submit():
                username = form.username.data
                password = form.password.data
                user = self.appbuilder.sm.auth_user_db(username, password)
                if user is None:
                    flash("用户名或密码错误", "error")
                    return self.render_template(self.login_template, form=form)
                login_user(user, remember=False)  # 默认不记住
                next_url = request.args.get("next", url_for("index"))
                return redirect(next_url)
        else:
            form = LoginForm_db()
        return self.render_template(
            self.login_template,
            form=form,
            appbuilder=self.appbuilder
        )

class CustomSecurityManager(SupersetSecurityManager):
    login_view = CustomLoginView

    def create_login_manager(self, app):
        lm = super().create_login_manager(app)
        lm.login_view = self.login_view
        return lm